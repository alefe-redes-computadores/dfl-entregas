/** Executado no CI DEPOIS do patch: prova que Java, Manifest, recursos e versão existem. */
import fs from 'node:fs';
const read = f => fs.readFileSync(f, 'utf8');
const base = 'android/app/src/main';
const a = read(`${base}/java/com/dfl/entregas/MainActivity.java`);
const m = read(`${base}/AndroidManifest.xml`);
const j = read(`${base}/java/com/dfl/entregas/DflApkUpdaterPlugin.java`);
const p = read(`${base}/java/com/dfl/entregas/DflApkFileProvider.java`);
const x = read(`${base}/res/xml/dfl_apk_paths.xml`);
const gradle = read('android/app/build.gradle');
const run = Number(process.env.GITHUB_RUN_NUMBER);
for (const [name, truthy] of [
  ['atividade', a.includes('registerPlugin(DflApkUpdaterPlugin.class);')],
  ['permissão', m.includes('android.permission.REQUEST_INSTALL_PACKAGES')],
  ['provider privado', m.includes('android:exported="false"') && m.includes('${applicationId}.dflapkprovider')],
  ['resources', x.includes('dfl-apk-updates/')],
  ['FileProvider', p.includes('extends FileProvider')],
  ['SHA256', j.includes('MessageDigest')],
  ['signature', j.includes('getApkContentsSigners')],
  ['package', j.includes('package com.dfl.entregas;')],
  ['build inteiro', Number.isSafeInteger(run) && gradle.includes(`versionCode ${run}`)],
]) {
  if (!truthy) throw new Error(`P360-P3 ANDROID: ${name} não aprovado`);
  console.log('OK:', name);
}
console.log('P360-P3_GENERATED_ANDROID_VALIDATED');
