const fs = require('fs');
const read = (file) => fs.readFileSync(file, 'utf8');
const ok = (value, message) => { if (!value) throw new Error(`V22 ADMIN BRIDGE: ${message}`); };

const bridge = read('lib/native/admin-bridge.ts');
const patch = read('scripts/patch-android-admin-bridge.mjs');
const hub = read('components/store/SiteAdminHub.tsx');
const page = read('app/site-admin/page.tsx');
const details = read('app/entregas/details/page.tsx');

ok(bridge.includes('registerPlugin<NativeAdminLauncherPlugin>'), 'plugin Capacitor ausente');
ok(bridge.includes('await NativeAdminLauncher.open({ url })'), 'abertura nativa não aguardada');
ok(!bridge.includes('window.location.href = externalOrderId'), 'intent WebView antigo permaneceu');
ok(bridge.includes('window.location.assign(url)'), 'fallback web bloqueado ausente');
ok(patch.includes('appIntent.setPackage(ADMIN_PACKAGE)'), 'tentativa no APK Admin ausente');
ok(patch.includes('getActivity().startActivity(browserIntent)'), 'fallback Android ausente');
ok(patch.includes('Destino do DFL Admin não autorizado'), 'validação do destino ausente');
ok(hub.includes('openingAdmin') && page.includes('openingAdmin') && details.includes('openingAdmin'), 'bloqueio contra toque duplo incompleto');
ok(hub.includes("result.target === 'browser'") && page.includes("result.target === 'browser'"), 'feedback de fallback incompleto');
ok(details.includes('delivery.external_order_id'), 'pedido exato deixou de ser preservado');

console.log('V22 PONTE NATIVA DFL ADMIN — CONTRATOS OK');
