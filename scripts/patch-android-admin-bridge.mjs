import fs from 'node:fs';
import path from 'node:path';

const manifestPath = 'android/app/src/main/AndroidManifest.xml';
const activityPath = 'android/app/src/main/java/com/dfl/entregas/MainActivity.java';
const pluginPath = 'android/app/src/main/java/com/dfl/entregas/AdminLauncherPlugin.java';

for (const file of [manifestPath, activityPath]) {
  if (!fs.existsSync(file)) throw new Error(`Ponte Admin: arquivo Android ausente após cap sync: ${file}`);
}

let manifest = fs.readFileSync(manifestPath, 'utf8');
if (!manifest.includes('android:scheme="dflentregas"')) {
  const re = /(<activity\b[^>]*android:name="[^"]*MainActivity"[^>]*>)([\s\S]*?)(<\/activity>)/;
  const match = manifest.match(re);
  if (!match) throw new Error('Ponte Admin: MainActivity não localizada no Manifest');
  const deepLink = `
            <!-- DFL: Admin → Entregas -->
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="dflentregas" android:host="delivery" />
            </intent-filter>`;
  manifest = manifest.replace(re, `${match[1]}${match[2]}${deepLink}${match[3]}`);
}

{
  const re = /<activity\b[^>]*android:name="[^"]*MainActivity"[^>]*>/;
  const match = manifest.match(re);
  if (!match) throw new Error('Ponte Admin: MainActivity não localizada para singleTask');
  if (!match[0].includes('android:launchMode="singleTask"')) {
    manifest = manifest.replace(match[0], match[0].replace(/>$/, ' android:launchMode="singleTask">'));
  }
}
fs.writeFileSync(manifestPath, manifest);

let activity = fs.readFileSync(activityPath, 'utf8');
if (!activity.includes('registerPlugin(AdminLauncherPlugin.class);')) {
  const anchor = 'super.onCreate(savedInstanceState);';
  if (!activity.includes(anchor)) throw new Error('Ponte Admin: ponto seguro de registro do plugin não encontrado');
  activity = activity.replace(anchor, `registerPlugin(AdminLauncherPlugin.class);\n        ${anchor}`);
  fs.writeFileSync(activityPath, activity);
}

const plugin = `package com.dfl.entregas;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AdminLauncher")
public class AdminLauncherPlugin extends Plugin {
    private static final String ADMIN_PACKAGE = "br.com.dafamilialanches.admin";
    private static final String ADMIN_HOST = "admin.dafamilialanches.com.br";

    @PluginMethod
    public void open(PluginCall call) {
        String rawUrl = call.getString("url", "");
        Uri uri;
        try {
            uri = Uri.parse(rawUrl);
        } catch (Exception error) {
            call.reject("Endereço do DFL Admin inválido.");
            return;
        }

        String route = uri.getPath();
        if (!"https".equalsIgnoreCase(uri.getScheme()) ||
                !ADMIN_HOST.equalsIgnoreCase(uri.getHost()) ||
                route == null || !(route.equals("/admin") || route.startsWith("/admin/"))) {
            call.reject("Destino do DFL Admin não autorizado.");
            return;
        }

        Intent appIntent = new Intent(Intent.ACTION_VIEW, uri);
        appIntent.addCategory(Intent.CATEGORY_BROWSABLE);
        appIntent.setPackage(ADMIN_PACKAGE);
        try {
            getActivity().startActivity(appIntent);
            resolve(call, "app");
            return;
        } catch (ActivityNotFoundException | SecurityException ignored) {
            // Admin ausente ou App Link indisponível: segue para o navegador.
        }

        Intent browserIntent = new Intent(Intent.ACTION_VIEW, uri);
        browserIntent.addCategory(Intent.CATEGORY_BROWSABLE);
        try {
            getActivity().startActivity(browserIntent);
            resolve(call, "browser");
        } catch (ActivityNotFoundException | SecurityException error) {
            JSObject result = new JSObject();
            result.put("opened", false);
            result.put("target", "none");
            result.put("message", "Não foi possível abrir o aplicativo nem o navegador.");
            call.resolve(result);
        }
    }

    private void resolve(PluginCall call, String target) {
        JSObject result = new JSObject();
        result.put("opened", true);
        result.put("target", target);
        call.resolve(result);
    }
}
`;

fs.mkdirSync(path.dirname(pluginPath), { recursive: true });
fs.writeFileSync(pluginPath, plugin);

const contracts = [
  [manifestPath, 'android:scheme="dflentregas"'],
  [manifestPath, 'android:host="delivery"'],
  [manifestPath, 'android:launchMode="singleTask"'],
  [activityPath, 'registerPlugin(AdminLauncherPlugin.class);'],
  [pluginPath, '@CapacitorPlugin(name = "AdminLauncher")'],
  [pluginPath, 'appIntent.setPackage(ADMIN_PACKAGE);'],
  [pluginPath, 'getActivity().startActivity(browserIntent);'],
];
for (const [file, token] of contracts) {
  if (!fs.readFileSync(file, 'utf8').includes(token)) throw new Error(`Ponte Admin: contrato ausente em ${file}: ${token}`);
}

console.log('PONTE NATIVA DFL ADMIN — CONTRATO ANDROID APLICADO');
