const fs = require('fs');

const sw = fs.readFileSync('public/sw.js', 'utf8');
const runtime = fs.readFileSync(
  'components/pwa/PwaRuntime.tsx',
  'utf8',
);
const prompt = fs.readFileSync(
  'components/pwa/PwaInstallPrompt.tsx',
  'utf8',
);

const failures = [];

if (!sw.includes("const VERSION = 'dfl-entregas-v6'")) {
  failures.push('SW V6 ausente');
}

if (!sw.includes("cache: 'no-store'")) {
  failures.push('navegação network-first forte ausente');
}

if (!sw.includes("url.pathname.startsWith('/_next/static/')")) {
  failures.push('cache imutável do Next ausente');
}

if (!sw.includes("url.pathname === '/sw.js'")) {
  failures.push('bypass do próprio SW ausente');
}

if (!runtime.includes("updateViaCache: 'none'")) {
  failures.push('updateViaCache ausente');
}

if (!runtime.includes("'controllerchange'")) {
  failures.push('controllerchange ausente');
}

if (!runtime.includes("'SKIP_WAITING'")) {
  failures.push('ativação imediata ausente');
}

if (
  prompt.includes(
    "navigator.serviceWorker.register('/sw.js')",
  )
) {
  failures.push(
    'registro duplicado ainda existe no InstallPrompt',
  );
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('OK: autoridade única de Service Worker');
console.log('OK: atualização imediata controlada');
console.log('OK: caches antigos serão invalidados');
console.log('OK: navegação prefere versão da rede');
console.log('OK: chunks Next continuam offline/cacheáveis');
