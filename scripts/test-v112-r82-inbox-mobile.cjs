#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
const read=f=>fs.readFileSync(f,'utf8');
const inbox=read('app/loja/caixa-de-entrada/page.tsx'),card=read('components/home/DeliveryCard.tsx');
for(const f of ['app/loja/caixa-de-entrada/page.tsx','components/home/DeliveryCard.tsx']){
 const a=ts.createSourceFile(f,read(f),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(a.parseDiagnostics.length,0,`Sintaxe TSX ${f}`);
}
assert(!inbox.includes('<Stat')&&!inbox.includes('function Stat('),'resumo estatístico duplicado removido');
assert(!inbox.includes('rascunhos pendentes`} className'),'contador repetido no cabeçalho removido');
assert((() => { const ui = require('node:fs').readFileSync('app/loja/caixa-de-entrada/page.tsx','utf8'); return ui.includes('>Site</button>') && ui.includes('>Importar</button>') && ui.includes('aria-label="Filtrar rascunhos da Caixa de Entrada"') && ui.includes('active.length') && ui.includes('review.length') && ui.includes('ready.length') && !ui.includes('<Stat'); })(),'filtros e contadores operacionais preservados');
assert(inbox.includes('launched.length > 0')&&inbox.includes('pedidos lançados'),'histórico de lançamentos continua visível discretamente');
assert(inbox.includes('rows={4}')&&inbox.includes('placeholder:text-zinc-500'),'entrada compacta e legível');
assert(!inbox.includes('· ainda não lançado')&&inbox.includes('Valor identificado:'),'status redundante do valor eliminado');
assert(inbox.includes('draft.confidence < 80')&&inbox.includes('draft.missingFields.join('),'incerteza visível somente quando útil');
assert(inbox.includes('onClick={onLaunch}')&&inbox.includes('onClick={onDiscard}')&&inbox.includes('onClick={processText}'),'ações de analisar, lançar e descartar preservadas');
assert(inbox.includes('SiteInboxPanel')&&inbox.includes('dedupeInboxImport')&&inbox.includes('persist([...unique, ...drafts])'),'Site, deduplicação e rascunhos intactos');
assert(card.includes('Origem ${channelStyle.label}')&&!card.includes("visualOrigin === 'site' ? 'Pedido do Site'"),'origem vertical sem chip repetido');
assert(card.includes('role="group" aria-label="Subir ou descer parada"')&&card.includes('Registrar tentativa (sem dar baixa)'),'rotas e tentativas R81 preservadas');
assert(!/onSnapshot\(|getDocs\(|runTransaction\(/.test(inbox),'sem novas consultas Firestore');
assert(read('scripts/pre-apk.cjs').includes("'scripts/test-v112-r82-inbox-mobile.cjs'"),'R82 integra PRE-APK');
console.log('R82: 15 verificações de UX, regressão e TSX aprovadas');
