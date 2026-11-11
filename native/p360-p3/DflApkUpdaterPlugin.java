package __PACKAGE__;

import android.content.ClipData;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * P360 P3: DFL Entregas. O arquivo nasce de um caminho GitHub Release conhecido,
 * nunca de URL fornecida pelo JavaScript. Validação offline do APK antes da instalação.
 */
@CapacitorPlugin(name = "DflApkUpdater")
public class DflApkUpdaterPlugin extends Plugin {
    private static final long MAX_BYTES = 150L * 1024L * 1024L;
    private static final String PREFS = "dfl_entregas_apk_p360";
    private static final String DIR = "dfl-apk-updates";
    private static final ExecutorService POOL = Executors.newSingleThreadExecutor();
    private final AtomicBoolean downloading = new AtomicBoolean(false);
    private final AtomicBoolean cancellationRequested = new AtomicBoolean(false);

    private long installedBuild() throws Exception {
        PackageInfo info = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
        return Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode;
    }

    private File apkFor(int build) {
        return new File(new File(getContext().getFilesDir(), DIR), "DFL-Entregas-" + build + ".apk");
    }

    private static boolean validHash(String x) { return x != null && x.matches("[a-fA-F0-9]{64}"); }

    private static String hex(byte[] input) {
        StringBuilder out = new StringBuilder(64);
        for (byte b : input) out.append(String.format(Locale.ROOT, "%02x", b & 0xff));
        return out.toString();
    }

    private static boolean trustedUrl(URL url) {
        String host = url.getHost().toLowerCase(Locale.ROOT);
        boolean hostAllowed = host.equals("github.com")
            || host.equals("release-assets.githubusercontent.com")
            || host.equals("objects.githubusercontent.com")
            || host.equals("github-releases.githubusercontent.com");
        return url.getProtocol().equals("https") && hostAllowed && url.getUserInfo() == null
            && (url.getPort() == -1 || url.getPort() == 443);
    }

    private static HttpURLConnection openDownload(int build) throws Exception {
        URL current = new URL("https://github.com/alefe-redes-computadores/dfl-entregas/releases/download/entregas-android-"
            + build + "/DFL-Entregas-" + build + ".apk");
        for (int redirect = 0; redirect < 7; redirect++) {
            if (!trustedUrl(current)) throw new SecurityException("Servidor de download não autorizado.");
            HttpURLConnection conn = (HttpURLConnection) current.openConnection();
            conn.setInstanceFollowRedirects(false);
            conn.setConnectTimeout(15_000);
            conn.setReadTimeout(30_000);
            conn.setRequestProperty("Accept", "application/octet-stream");
            conn.setRequestProperty("User-Agent", "DFL-Entregas-Android-Update/1");
            int status = conn.getResponseCode();
            if (status == 200) return conn;
            if (status == 301 || status == 302 || status == 303 || status == 307 || status == 308) {
                String redirectUrl = conn.getHeaderField("Location");
                if (redirectUrl == null) { conn.disconnect(); throw new Exception("Redirecionamento de APK inválido."); }
                URL next = new URL(current, redirectUrl);
                conn.disconnect();
                current = next;
                continue;
            }
            conn.disconnect();
            throw new Exception("APK indisponível no servidor (HTTP " + status + ").");
        }
        throw new SecurityException("Redirecionamentos excessivos.");
    }

    private static String sha256(File file) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        try (InputStream in = new BufferedInputStream(new FileInputStream(file))) {
            byte[] bytes = new byte[65536]; int n;
            while ((n = in.read(bytes)) != -1) md.update(bytes, 0, n);
        }
        return hex(md.digest());
    }

    private static Signature[] signers(PackageInfo info) {
        if (Build.VERSION.SDK_INT >= 28) {
            return info.signingInfo != null ? info.signingInfo.getApkContentsSigners() : null;
        }
        return info.signatures;
    }

    private void verifyPackage(File file, int build) throws Exception {
        PackageManager pm = getContext().getPackageManager();
        int flags = Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
        PackageInfo archive = pm.getPackageArchiveInfo(file.getAbsolutePath(), flags);
        if (archive == null || !getContext().getPackageName().equals(archive.packageName))
            throw new SecurityException("Pacote APK não corresponde ao DFL Entregas.");
        long version = Build.VERSION.SDK_INT >= 28 ? archive.getLongVersionCode() : archive.versionCode;
        if (version != build || version <= installedBuild())
            throw new SecurityException("Número de build incompatível ou anterior ao instalado.");
        PackageInfo installed = pm.getPackageInfo(getContext().getPackageName(), flags);
        Signature[] current = signers(installed);
        Signature[] candidate = signers(archive);
        if (current == null || candidate == null || current.length != 1 || candidate.length != 1 ||
            !Arrays.equals(current[0].toByteArray(), candidate[0].toByteArray()))
            throw new SecurityException("Certificado do APK não corresponde ao aplicativo instalado.");
    }

    @PluginMethod
    public void downloadVerified(PluginCall call) {
        Integer build = call.getInt("build");
        String expected = call.getString("sha256");
        long bytes = call.getData().optLong("bytes", 0L);
        if (build == null || build <= 0 || !validHash(expected) || bytes < 100_000L || bytes > MAX_BYTES) {
            call.reject("Metadados de atualização inválidos."); return;
        }
        try { if (build <= installedBuild()) { call.reject("Versão já instalada."); return; } }
        catch (Exception e) { call.reject("Não foi possível conferir o APK instalado."); return; }
        if (!downloading.compareAndSet(false, true)) { call.reject("Já existe um download em andamento."); return; }
        cancellationRequested.set(false);
        POOL.execute(() -> {
            File temp = null;
            HttpURLConnection connection = null;
            try {
                File target = apkFor(build);
                File dir = target.getParentFile();
                if (dir == null || (!dir.isDirectory() && !dir.mkdirs())) throw new Exception("Pasta privada indisponível.");
                temp = new File(dir, "download-" + build + ".partial");
                if (temp.exists() && !temp.delete()) throw new Exception("Download parcial não pôde ser substituído.");
                connection = openDownload(build);
                long total = connection.getContentLengthLong();
                if (total > MAX_BYTES || (total > 0 && total != bytes))
                    throw new SecurityException("Tamanho remoto divergente.");
                MessageDigest digest = MessageDigest.getInstance("SHA-256");
                long received = 0, lastEvent = 0;
                try (InputStream input = new BufferedInputStream(connection.getInputStream());
                     FileOutputStream output = new FileOutputStream(temp)) {
                    byte[] buffer = new byte[65536]; int n;
                    while ((n = input.read(buffer)) != -1) {
                        if (cancellationRequested.get()) throw new Exception("Download cancelado.");
                        received += n;
                        if (received > bytes || received > MAX_BYTES) throw new SecurityException("Arquivo excedeu tamanho certificado.");
                        output.write(buffer, 0, n);
                        digest.update(buffer, 0, n);
                        if (received - lastEvent >= 262_144 || received == bytes) {
                            lastEvent = received;
                            JSObject progress = new JSObject();
                            progress.put("build", build);
                            progress.put("received", received);
                            progress.put("total", bytes);
                            progress.put("percent", (int)Math.min(100, received * 100 / bytes));
                            notifyListeners("downloadProgress", progress);
                        }
                    }
                    output.getFD().sync();
                }
                if (cancellationRequested.get()) throw new Exception("Download cancelado.");
                if (received != bytes || !hex(digest.digest()).equalsIgnoreCase(expected))
                    throw new SecurityException("Falha na verificação SHA-256.");
                if (target.exists() && !target.delete()) throw new Exception("APK anterior não pôde ser substituído.");
                if (cancellationRequested.get()) throw new Exception("Download cancelado.");
                if (!temp.renameTo(target)) throw new Exception("Não foi possível finalizar o APK.");
                temp = null;
                verifyPackage(target, build);
                if (cancellationRequested.get()) throw new Exception("Download cancelado.");
                getContext().getSharedPreferences(PREFS, 0).edit()
                    .putInt("build", build).putString("sha256", expected.toLowerCase(Locale.ROOT))
                    .putLong("size", bytes).apply();
                JSObject result = new JSObject(); result.put("verified", true); result.put("build", build);
                call.resolve(result);
            } catch (Exception error) {
                getContext().getSharedPreferences(PREFS, 0).edit().clear().apply();
                call.reject("Atualização não verificada: " + error.getMessage());
            } finally {
                if (connection != null) connection.disconnect();
                if (temp != null && temp.exists()) temp.delete();
                downloading.set(false);
                cancellationRequested.set(false);
            }
        });
    }

    @PluginMethod
    public void cancelDownload(PluginCall call) {
        boolean active = downloading.get();
        if (active) cancellationRequested.set(true);
        JSObject result = new JSObject(); result.put("requested", active);
        call.resolve(result);
    }

    @PluginMethod
    public void installVerified(PluginCall call) {
        Integer build = call.getInt("build");
        String hash = call.getString("sha256");
        if (build == null || build <= 0 || !validHash(hash)) { call.reject("Atualização inválida."); return; }
        POOL.execute(() -> {
            try {
                android.content.SharedPreferences pref = getContext().getSharedPreferences(PREFS, 0);
                File file = apkFor(build);
                if (pref.getInt("build", 0) != build || !hash.equalsIgnoreCase(pref.getString("sha256", "")) ||
                    !file.isFile() || file.length() != pref.getLong("size", -1L) ||
                    !sha256(file).equalsIgnoreCase(hash))
                    throw new SecurityException("Arquivo não passou na nova conferência de integridade.");
                verifyPackage(file, build);
                if (Build.VERSION.SDK_INT >= 26 && !getContext().getPackageManager().canRequestPackageInstalls()) {
                    JSObject result = new JSObject(); result.put("permissionRequired", true);
                    call.resolve(result); return;
                }
                Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".dflapkprovider", file);
                getActivity().runOnUiThread(() -> {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW);
                        intent.setDataAndType(uri, "application/vnd.android.package-archive");
                        intent.setClipData(ClipData.newUri(getContext().getContentResolver(), "Atualização DFL Entregas", uri));
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        getActivity().startActivity(intent);
                        JSObject result = new JSObject(); result.put("opened", true);
                        call.resolve(result);
                    } catch (Exception e) { call.reject("Instalador Android indisponível."); }
                });
            } catch (Exception error) { call.reject("Instalação bloqueada: " + error.getMessage()); }
        });
    }

    /** Recuperação manual em navegador externo; nenhuma URL recebida do JavaScript. */
    @PluginMethod
    public void openReleasePage(PluginCall call) {
        Integer build = call.getInt("build");
        if (build == null || build <= 0) { call.reject("Build inválido."); return; }
        getActivity().runOnUiThread(() -> {
            try {
                Uri uri = Uri.parse("https://github.com/alefe-redes-computadores/dfl-entregas/releases/tag/entregas-android-" + build);
                Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                intent.addCategory(Intent.CATEGORY_BROWSABLE);
                getActivity().startActivity(intent);
                JSObject result = new JSObject(); result.put("opened", true); call.resolve(result);
            } catch (Exception e) { call.reject("Não foi possível abrir a Release no navegador."); }
        });
    }

    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT < 26) { call.resolve(); return; }
        getActivity().runOnUiThread(() -> {
            try {
                Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getContext().getPackageName()));
                getActivity().startActivity(intent);
                call.resolve();
            } catch (Exception e) { call.reject("Não foi possível abrir as permissões Android."); }
        });
    }
}
