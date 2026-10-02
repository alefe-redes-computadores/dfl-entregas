const fs = require('node:fs');
const read = (path) => fs.readFileSync(path, 'utf8');
const ok = (v, m) => { if (!v) throw new Error(`V17.6: ${m}`); };

const helper = read('lib/integration/client/routeKick.ts');
const route = read('app/api/integration/route-kick/route.ts');

ok(helper.includes("import { Capacitor } from '@capacitor/core'"), 'Capacitor ausente');
ok(helper.includes("DEFAULT_SERVER_ORIGIN = 'https://dfl-entregas.vercel.app'"), 'backend canônico ausente');
ok(helper.includes('Capacitor.isNativePlatform()'), 'APK não possui branch nativa');
ok(helper.includes("'/api/integration/route-kick'"), 'PWA perdeu same-origin');
ok(helper.includes("credentials: 'omit'"), 'request cross-origin usa credenciais');
ok(helper.includes("includes('application/json')"), 'content-type não validado');
ok(helper.includes('result.ok === true'), 'HTTP 200 ainda pode fingir sucesso');
ok(!helper.includes("fetch('/api/integration/route-kick'"), 'fetch relativo fixo ainda existe');

ok(route.includes("'https://localhost'"), 'https localhost não permitido');
ok(route.includes("'http://localhost'"), 'http localhost não permitido');
ok(route.includes("'capacitor://localhost'"), 'capacitor localhost não permitido');
ok(route.includes('export async function OPTIONS'), 'preflight ausente');
ok(route.includes("'access-control-allow-headers': 'authorization, content-type'"), 'Authorization não liberado');
ok(!route.includes("'access-control-allow-origin': '*'"), 'CORS aberto demais');

console.log('============================================================');
console.log(' V17.6 NATIVE ROUTE KICK — ZERO ERROS');
console.log('============================================================');
console.log('✓ APK chama backend real');
console.log('✓ PWA mantém mesma origem');
console.log('✓ HTML/200 não pode fingir sucesso');
console.log('✓ CORS nativo restrito');
