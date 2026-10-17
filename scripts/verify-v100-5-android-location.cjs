const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const read = p => fs.readFileSync(p, 'utf8');
const workflow = read('.github/workflows/main.yml');
const tool = read('scripts/patch-android-location-permissions.mjs');
const device = read('lib/device-location.ts');
const origin = read('lib/store-origin.ts');
const store = read('store/useAppStore.ts');
const loja = read('app/loja/page.tsx');
const routes = read('components/home/RouteAccordion.tsx');
const css = read('app/globals.css');
const guide = read('components/location/LocationPermissionGuide.tsx');

assert(workflow.includes('node scripts/patch-android-location-permissions.mjs'), 'workflow aplica permissão');
const syncIndex = workflow.indexOf('npx cap sync android');
const patchIndex = workflow.indexOf('node scripts/patch-android-location-permissions.mjs');
const gradleIndex = workflow.indexOf('./gradlew clean assembleDebug');
assert(syncIndex > 0 && patchIndex > syncIndex && patchIndex < gradleIndex,
  'patch só roda depois do último cap sync e antes do APK');
assert(tool.includes('ACCESS_FINE_LOCATION') && tool.includes('ACCESS_COARSE_LOCATION'), 'permissões nativas exigidas');
const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'dfl-v1005-gps-'));
try {
  const manifest = path.join(folder, 'AndroidManifest.xml');
  fs.writeFileSync(manifest, '<manifest xmlns:android="http://schemas.android.com/apk/res/android"><application /></manifest>');
  for (let i=0;i<2;i++) {
    const result=spawnSync(process.execPath, ['scripts/patch-android-location-permissions.mjs', manifest], {encoding:'utf8'});
    assert.equal(result.status,0,result.stderr || result.stdout);
  }
  const body=read(manifest);
  assert.equal((body.match(/android.permission.ACCESS_FINE_LOCATION/g)||[]).length,1);
  assert.equal((body.match(/android.permission.ACCESS_COARSE_LOCATION/g)||[]).length,1);
  assert.equal((body.match(/android.hardware.location.gps/g)||[]).length,1);
  assert(body.includes('android:required="false"'),'GPS não é hardware obrigatório');
} finally { fs.rmSync(folder,{recursive:true,force:true}); }
assert(device.includes('Geolocation.checkPermissions()') && device.includes("Geolocation.requestPermissions({ permissions: ['location'] })"), 'check + prompt Capacitor');
assert(device.includes('navigator.geolocation.getCurrentPosition'), 'PWA permanece suportada');
assert(device.includes('Capacitor.isNativePlatform()') && device.includes('throw nativeFailure(error)'), 'erro nativo explícito');
assert(device.includes("code === 1"), 'permissão bloqueada do navegador não mascarada');
assert(origin.includes('lat === 0 && lng === 0'), 'bloqueia coordenadas 0,0');
assert(origin.includes('hasSpecificStoreAddress'), 'cidade isolada não é origem');
assert(store.includes('validOriginPoint(settings.storeLatitude, settings.storeLongitude)'), 'reordenação automática exige ponto válido');
assert(routes.includes('storedOriginPoint(storeSettings)') && routes.includes('hasSpecificStoreAddress(storeAddress)'), 'rota não geocodifica cidade isolada');
assert(routes.includes('if (storeAddress && hasSpecificStoreAddress(storeAddress))'), 'endereço precisa ser string antes de geocodificar');
assert(routes.includes('GPS atual · origem provisória'), 'origem temporária identificada');
assert(routes.includes('LocationPermissionGuide'), 'rota ensina desbloquear GPS');
assert(loja.includes('LocationPermissionGuide') && loja.includes('setLocationFailure('), 'Loja explica bloqueio de localização');
assert(loja.includes('Usar GPS e salvar origem da loja'), 'captura com ação clara');
assert(guide.includes('Configurações → Aplicativos') && guide.includes('navegador ou PWA'), 'diagnóstico contextual Android/PWA');
assert(css.includes('html[data-dfl-platform="android"] header.safe-top'), 'header respeita status bar nativa');
console.log('V100.5: Manifest, prompt, PWA, origem confiável, UX e status bar — OK');
