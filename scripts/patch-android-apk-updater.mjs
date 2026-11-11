/** P360 P3 — sobre o Android EFÊMERO do CI, depois do cap sync e bridge Admin. */
import fs from 'node:fs';
import path from 'node:path';

const main = 'android/app/src/main/java/com/dfl/entregas/MainActivity.java';
const manifestFile = 'android/app/src/main/AndroidManifest.xml';
const gradleFile = 'android/app/build.gradle';
const templateDir = 'native/p360-p3';
for (const file of [main, manifestFile, gradleFile, `${templateDir}/DflApkUpdaterPlugin.java`, `${templateDir}/DflApkFileProvider.java`, `${templateDir}/dfl_apk_paths.xml`]) {
  if (!fs.existsSync(file)) throw new Error(`P360-P3: arquivo necessário ausente: ${file}`);
}
const run = Number(process.env.GITHUB_RUN_NUMBER);
if (!Number.isSafeInteger(run) || run < 1 || run > 999_999_999) throw new Error('P360-P3: GITHUB_RUN_NUMBER inválido; versionCode precisa vir da Action.');

let activity = fs.readFileSync(main, 'utf8');
if (!activity.includes('registerPlugin(AdminLauncherPlugin.class);')) throw new Error('P360-P3: ponte Admin deve estar instalada ANTES da atualização.');
if (!activity.includes('registerPlugin(DflApkUpdaterPlugin.class);')) {
  const anchor = 'registerPlugin(AdminLauncherPlugin.class);';
  activity = activity.replace(anchor, `${anchor}\n        registerPlugin(DflApkUpdaterPlugin.class);`);
  fs.writeFileSync(main, activity);
}
const dir = path.dirname(main);
for (const name of ['DflApkUpdaterPlugin.java', 'DflApkFileProvider.java']) {
  const template = fs.readFileSync(`${templateDir}/${name}`, 'utf8');
  if (!template.startsWith('package __PACKAGE__;')) throw new Error(`P360-P3: Java template inválido ${name}`);
  fs.writeFileSync(`${dir}/${name}`, template.replace('package __PACKAGE__;', 'package com.dfl.entregas;'));
}
const xmlTarget = 'android/app/src/main/res/xml/dfl_apk_paths.xml';
fs.mkdirSync(path.dirname(xmlTarget), { recursive: true });
fs.copyFileSync(`${templateDir}/dfl_apk_paths.xml`, xmlTarget);

let manifest = fs.readFileSync(manifestFile, 'utf8');
if (!manifest.includes('android.permission.REQUEST_INSTALL_PACKAGES')) {
  if (!manifest.includes('<application')) throw new Error('P360-P3: Manifest inválido.');
  manifest = manifest.replace(/<application\b/, '<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />\n    <application');
}
if (!manifest.includes('.dflapkprovider')) {
  const provider = `\n        <provider android:name="com.dfl.entregas.DflApkFileProvider" android:authorities="\${applicationId}.dflapkprovider" android:exported="false" android:grantUriPermissions="true">\n            <meta-data android:name="android.support.FILE_PROVIDER_PATHS" android:resource="@xml/dfl_apk_paths" />\n        </provider>\n`;
  if (!manifest.includes('</application>')) throw new Error('P360-P3: elemento application não encontrado.');
  manifest = manifest.replace('</application>', provider + '    </application>');
}
fs.writeFileSync(manifestFile, manifest);

let gradle = fs.readFileSync(gradleFile, 'utf8');
const re = /\bversionCode\s+\d+\b/;
if (!re.test(gradle)) throw new Error('P360-P3: versionCode não encontrado.');
gradle = gradle.replace(re, `versionCode ${run}`);
// preservar o versionName existente e versão exibida; somente versionCode define atualização.
fs.writeFileSync(gradleFile, gradle);
for (const [file, check] of [
  [main, 'registerPlugin(DflApkUpdaterPlugin.class);'],
  [manifestFile, 'android.permission.REQUEST_INSTALL_PACKAGES'],
  [manifestFile, '${applicationId}.dflapkprovider'],
  [manifestFile, 'android:exported="false"'],
  [gradleFile, `versionCode ${run}`],
  [`${dir}/DflApkUpdaterPlugin.java`, '@CapacitorPlugin(name = "DflApkUpdater")'],
  [xmlTarget, 'dfl-apk-updates/'],
]) if (!fs.readFileSync(file, 'utf8').includes(check)) throw new Error(`P360-P3: contrato inválido em ${file}: ${check}`);
console.log(`P360-P3_ANDROID_READY: build ${run} · plugin · FileProvider privado · permissão · versão`);
