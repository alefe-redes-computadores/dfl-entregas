'use strict';
/* R57: apresentação, acessibilidade e links. Sem Firestore, rede ou efeitos externos. */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const store = fs.readFileSync('app/loja/page.tsx', 'utf8');
const more = fs.readFileSync('app/mais/page.tsx', 'utf8');
let checks = 0;
function ok(test, description) { assert.ok(test, 'R57: ' + description); checks++; }
for (const path of ['app/loja/page.tsx','app/mais/page.tsx']) {
  const parsed = ts.createSourceFile(path, fs.readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  ok(parsed.parseDiagnostics.length === 0, `TSX ${path}: ${parsed.parseDiagnostics.map(x=>x.messageText).join(', ')}`);
}
function excerpt(src, start, end) {
  const a = src.indexOf(start); const b = src.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `Estrutura ausente: ${start}`);
  return src.slice(a, b + end.length);
}
const support = excerpt(store, '<nav aria-label="Acesso rápido a confirmações e histórico"', '</nav>');
for (const [href,label,icon] of [
  ["/confirmacoes",'Confirmar iFood','ShieldCheck'],
  ['/loja/caixa-de-entrada?aba=site&historico=1','Histórico do Site','History'],
  ['/mais/preferencias','Preferências 360','SlidersHorizontal'],
]) {
  ok(support.includes(`router.push('${href}')`), `atalho ${label} mantém destino`);
  ok(support.includes(label), `atalho ${label} mantém nome`);
  ok(support.includes(`<${icon} size={`), `atalho ${label} tem ícone Lucide`);
}
ok(support.includes('Códigos e pendências') && support.includes('Pedidos anteriores') && support.includes('Rotas, parceiros e alertas'), 'descrições curtas úteis nos atalhos');
ok(support.includes('text-left') && support.includes('focus-visible:outline'), 'alvos de toque e teclado explícitos');
ok(store.includes('Logística, plataformas e preferências') && store.includes('Conferir valores atuais'), 'configuração e resumo continuam compreensíveis');
ok(store.includes('Central de Preferências 360 · ver tudo') && store.includes('<Info size={16}'), 'atalhos secundários recuperam ícones');
for (const route of ['/clientes','/equipe','/motoboys','/abastecimentos','/estoque','/despesas'])
  ok(store.includes(`router.push('${route}')`), `Loja preserva ${route}`);
ok(store.includes('onClick={toggleStore}') && store.includes('saveDayEditor') && store.includes('handleSaveAllSettings'), 'abertura, expediente e gravação intactos');
ok(store.includes('configuredMarketplaceMode') && store.includes('mergeMarketplacePreference'), 'modos de entrega usam a autoridade já existente');
ok(store.includes('Alterar aqui não reclassifica entregas, pagamentos ou acertos anteriores.'), 'regra de histórico e modalidades segue explícita');
const technical = excerpt(more, 'Acessos técnicos diretos', '      </details>');
ok(technical.includes("router.push('/mais/mensageria')") && technical.includes('<MessageSquareText size={17}'), 'Mensageria técnica com ícone e destino');
ok(technical.includes("router.push('/mais/acompanhamento')") && technical.includes('<ShieldCheck size={17}'), 'Acompanhamento técnico com ícone e destino');
ok(more.includes('isDiagnosticsAdmin && <section') && more.includes('isSuperadminUid'), 'áreas técnicas continuam protegidas por permissão');
ok(more.includes('legacyRadarOpen && <OperationalRadar />') && more.includes('aria-hidden="true" className="hidden"'), 'radar legado isolado como antes');
ok(more.includes("router.push('/mais/atualizacoes')") && more.includes("router.push('/mais/notificacoes')"), 'atualizações e notificações preservadas');
ok(!/\b(?:onSnapshot|runTransaction|setDoc|updateDoc|sendWhatsapp)\s*\(/.test(support + technical), 'novos atalhos não criam ações de escrita nem envio');
console.log(`R57_LUCIDE_OK: ${checks} garantias e 2 arquivos TSX sem erro de parse.`);
