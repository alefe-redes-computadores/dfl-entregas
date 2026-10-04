const fs = require('fs');

const read = (file) => fs.readFileSync(file, 'utf8');
let failed = 0;
const check = (label, condition) => {
  if (condition) console.log(`OK: ${label}`);
  else { console.error(`ERRO: ${label}`); failed += 1; }
};

const runtime = read('components/NativeRuntime.tsx');
const header = read('components/layout/Header.tsx');
const notifications = read('lib/native/notifications.ts');
const details = read('app/entregas/details/page.tsx');
const adminPage = read('app/site-admin/page.tsx');
const hub = read('components/store/SiteAdminHub.tsx');

check('resume nativo sinaliza atualização operacional', runtime.includes("window.dispatchEvent(new Event('dfl:app-foreground'))"));
check('header usa o mesmo cooldown no PWA e no APK', header.includes("window.addEventListener('dfl:app-foreground', refreshOnForeground)") && header.includes('120_000'));
check('listener de resume possui limpeza', header.includes("window.removeEventListener('dfl:app-foreground', refreshOnForeground)"));
check('notificação abre pedidos pendentes do Site', notifications.includes("href: '/loja?site=pending'"));
check('query antiga e inerte foi removida', !notifications.includes("href: '/loja?tab=site'"));
check('ficha sempre libera botão do Admin', /finally\s*\{\s*setOpeningAdmin\(false\)/.test(details));
check('página Admin sempre libera botão', /finally\s*\{\s*setOpeningAdmin\(false\)/.test(adminPage));
check('hub sempre libera botão', /finally\s*\{\s*setOpeningAdmin\(false\)/.test(hub));
check('nenhum polling foi introduzido', !runtime.includes('setInterval(') && !header.includes('setInterval('));

if (failed) {
  console.error(`\nV23 POLIMENTO FINAL: ${failed} contrato(s) falharam.`);
  process.exit(1);
}

console.log('\nV23 POLIMENTO FINAL SITE + APK: CONTRATOS OK');
