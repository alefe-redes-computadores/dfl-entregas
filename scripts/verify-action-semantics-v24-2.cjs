const fs = require('node:fs');
const read = (file) => fs.readFileSync(file, 'utf8');
const ok = (value, label) => { if (!value) throw new Error(`V24.2: ${label}`); console.log('OK:', label); };
const nav = read('components/layout/BottomNav.tsx');
const route = read('components/home/RouteAccordion.tsx');

ok(nav.includes("tone: 'sky'") && nav.includes("tone: 'emerald'"), 'rota e entrega possuem cores semanticas distintas');
ok(nav.includes('border-sky-500/20') && nav.includes('border-emerald-500/20'), 'cards carregam a cor da acao');
ok(route.includes('Rota e contatos') && route.includes('MapPinned'), 'primeira mensagem comunica logistica');
ok(route.includes('Checklist de saída') && route.includes('ClipboardCheck'), 'segunda mensagem comunica conferencia');
ok(route.includes('Dinheiro da rota') && route.includes('Wallet'), 'terceira mensagem comunica financeiro');
ok(route.includes('safe-bottom') && route.includes('max-h-[88dvh]'), 'sheet respeita Android e telas compactas');
ok(!route.includes('Mensagem 1 (Logística)') && !route.includes('Mensagem 2 (Acerto)'), 'rotulos tecnicos antigos removidos');

console.log('\nV24.2 SEMANTICA DAS ACOES: CONTRATOS OK');
