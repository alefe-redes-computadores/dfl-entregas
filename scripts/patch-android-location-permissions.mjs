import fs from 'node:fs';

// Cap add/sync recria android/ em cada build. Sem este patch, o GPS nativo
// não aparece nem na lista de permissões do Android.
const manifestPath = process.argv[2] || 'android/app/src/main/AndroidManifest.xml';
if (!fs.existsSync(manifestPath)) {
  throw new Error(`AndroidManifest ausente: ${manifestPath}. Execute após cap sync.`);
}
let source = fs.readFileSync(manifestPath, 'utf8');
const start = source.match(/<manifest\b[^>]*>/);
if (!start) throw new Error('AndroidManifest inválido: tag <manifest> ausente.');
const required = [
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_FINE_LOCATION',
];
for (const permission of required) {
  if (!source.includes(`android:name="${permission}"`)) {
    source = source.replace(start[0], `${start[0]}\n    <uses-permission android:name="${permission}" />`);
  }
}
// GPS físico é opcional (localização por rede também pode ser usada).
if (!source.includes('android.hardware.location.gps')) {
  source = source.replace(start[0], `${start[0]}\n    <uses-feature android:name="android.hardware.location.gps" android:required="false" />`);
}
for (const permission of required) {
  if (!source.includes(`android:name="${permission}"`)) throw new Error(`Permissão ausente: ${permission}`);
}
fs.writeFileSync(manifestPath, source);
console.log('DFL Android localização: permissões FINE e COARSE declaradas; GPS opcional.');
