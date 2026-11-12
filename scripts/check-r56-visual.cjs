'use strict';
/* R56 — contratos de apresentação e navegação; nenhum acesso à rede. */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const read = p => fs.readFileSync(p, 'utf8');
const store = read('app/loja/page.tsx');
const prefs = read('app/mais/preferencias/page.tsx');
const comm = read('app/mais/comunicacao/page.tsx');
const search = read('components/assistant/GlobalAssistantPalette.tsx');
const css = read('app/globals.css');
let count = 0;
function ok(condition, title) {
  assert.ok(condition, 'R56 FALHOU: ' + title);
  count++;
}
for (const file of ['app/loja/page.tsx', 'app/mais/preferencias/page.tsx', 'app/mais/comunicacao/page.tsx', 'components/assistant/GlobalAssistantPalette.tsx']) {
  const tree = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal(tree.parseDiagnostics.length, 0, `${file}: ${tree.parseDiagnostics.map(d => d.messageText).join('; ')}`);
  count++;
}
ok(css.includes('.dfl-r237-command-sheet [role="search"] input[type="search"]:focus-visible'), 'foco especial somente na Busca 360');
ok(css.includes('.dfl-r237-command-sheet [role="search"]:focus-within') && css.includes('rgba(251,191,36,.18)'), 'indicador de foco dourado preservado');
ok(css.includes('button:focus-visible, a:focus-visible, input:focus-visible'), 'acessibilidade global preservada');
ok(search.includes('role="search"') && search.includes('ref={inputRef}') && search.includes('focus-within:border-amber-400/60'), 'busca global permanece funcional e com foco do formulário');
for (const [route, label, icon] of [['clientes','Clientes','UserRound'],['equipe','Equipe','UsersRound'],['motoboys','Motoboys','Bike']]) {
  ok(store.includes(`router.push('/${route}')`) && store.includes(`aria-label="Abrir ${label}"`) && store.includes(`<${icon} size={18}`), `Loja: atalho ${label} com ícone Lucide real`);
}
ok(store.includes('Quem faz a entrega?') && store.includes('Entregador da plataforma') && store.includes('Entregador da DFL'), 'resumo explica o responsável pela entrega');
ok(store.includes('Entra nas rotas DFL') && store.includes('Fora das rotas DFL'), 'resumo esclarece a consequência logística');
ok(store.includes("configuredMarketplaceMode(storeSettings.marketplaceDeliveryModes, item.source)"), 'modos por plataforma vêm do estado persistido');
ok(store.includes('A escolha vale para novos pedidos.'), 'histórico não é descrito como reclassificado');
ok(store.includes('aria-label="Resumo das preferências operacionais"') && store.includes('Conferir valores atuais'), 'resumo permanece recolhível');
ok(prefs.includes('mergeMarketplacePreference') && prefs.includes('updateSettings(patch)'), 'editor continua usando a autoridade existente');
ok(prefs.includes('Entrega da plataforma') && prefs.includes('A plataforma envia o próprio entregador.'), 'editor explica quem faz a entrega');
ok(prefs.includes('Histórico, pagamentos e acertos não mudam.'), 'consequência histórica preservada');
ok(comm.includes("isSuperadminUid(owner?.uid)") && comm.includes('if(!allowed) return'), 'Comunicação 360 protegida por proprietário');
ok(comm.includes("section==='mensagens'") && comm.includes("section==='acompanhamento'"), 'subpáginas não são montadas juntas');
ok(comm.includes('Emissão automática de link permanece OFF'), 'restrição do link público preservada');
ok(comm.includes('Acompanhe cada etapa') && comm.includes('Materiais da operação'), 'comunicação com textos claros, sem perder materiais');
ok(store.includes('onClick={toggleStore}') && store.includes('saveDayEditor') && store.includes('handleSaveAllSettings'), 'abertura, expediente e salvamento canônicos');
for (const route of ['/abastecimentos','/estoque','/despesas','/confirmacoes','/loja/caixa-de-entrada']) ok(store.includes(route), `Loja: ${route} preservado`);
ok(!/\b(?:onSnapshot|setDoc|updateDoc|runTransaction|sendWhatsapp)\s*\(/.test([comm, prefs].join('\n')), 'subpáginas não ganharam gravadores/listeners novos');
console.log(`R56_VIDEO_PREMIUM_OK: ${count} contratos, quatro TSX parseados, sem rede ou alteração da operação.`);
