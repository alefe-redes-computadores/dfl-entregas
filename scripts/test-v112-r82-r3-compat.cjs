'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const backup=process.argv[2];
const cardPath='components/home/DeliveryCard.tsx';
const routePath='components/home/RouteAccordion.tsx';
const inboxPath='app/loja/caixa-de-entrada/page.tsx';
const read=p=>fs.readFileSync(p,'utf8');
const card=read(cardPath),route=read(routePath),inbox=read(inboxPath);
const check=(name,yes)=>{assert.ok(yes,name);console.log('OK: '+name);};
for(const file of [cardPath,routePath,inboxPath]) {
 const ast=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 if(ast.parseDiagnostics.length) {
   for(const d of ast.parseDiagnostics.slice(0,8)){
     const pos=ast.getLineAndCharacterOfPosition(d.start||0);
     console.error(`${file}:${pos.line+1}:${pos.character+1} ${ts.flattenDiagnosticMessageText(d.messageText,' ')}`);
   }
   throw new Error('JSX/TS invalido: '+file);
 }
 console.log('OK: sintaxe '+file);
}
const compact=card.split('{/* VISUALIZAÇÃO COMPACTA — operação em duas linhas')[1]?.split('{/* VISUALIZAÇÃO EXPANDIDA */}')[0]||'';
check('compacto em duas linhas sem preview ou MiniMap',compact.includes('Ações rápidas da parada') && !compact.includes('LocationEvidencePreview') && !compact.includes('<MiniMap'));
check('origem vertical pequena',card.includes('self-start')&&card.includes('h-[65px]'));
check('Pix e baixa presentes',compact.includes('Pix pendente') && compact.includes('Dar baixa'));
check('WhatsApp e expandir presentes',compact.includes('wa.me/') && compact.includes('Expandir detalhes da parada'));
check('setas e limites preservados',compact.includes('aria-label="Subir ou descer parada"')&&compact.includes('disabled={reorderBusy || orderLocked || (position || 1) <= 1}')&&compact.includes('disabled={reorderBusy || orderLocked || (position || 1) >= pendingCount}'));
check('sem drag de rota',!card.includes('onPointerMove={handleReorderPointerMove}'));
check('baixa/agrupamento/tentativas presentes',card.includes('groupedCodeDeliveries')&&card.includes('pendingGroupedDeliveries')&&card.includes('Registrar tentativa (sem dar baixa)'));
check('mapa so expandido',!compact.includes('LocationEvidencePreview')&&card.includes('<LocationEvidencePreview address={delivery.address_string}'));
check('Inbox canais Site, Importar',inbox.includes('>Site</button>')&&inbox.includes('>Importar</button>'));
check('Inbox Site e parsers preservados',inbox.includes('SiteInboxPanel')&&inbox.includes('parseIfoodOrdersText')&&inbox.includes('normalizeFood99Order'));
check('filtros Inbox',inbox.includes('aria-label="Filtrar rascunhos da Caixa de Entrada"'));
check('rota evita sequencia e chips em parada simples',route.includes('routePreviewStops.length > 1')&&route.includes('totalDeliveries > 1 && totalStops !== totalDeliveries'));
check('planejamento disponivel',route.includes('PreRouteIntelligence')&&route.includes('RouteSequenceAdvisor'));
// Validate local expanded JSX survived identically except for three safe duplicate-label removals.
if(backup){
 const original=read(path.join(backup,'originais',cardPath));
 const from='              <div className="px-4 pb-3 flex flex-col gap-2.5">';
 const to='              {canDismissFromOperation && (';
 const region=s=>{const a=s.indexOf(from),b=s.indexOf(to,a+from.length);assert.ok(a>=0&&b>a,'expanded markers');return s.slice(a,b)};
 let exp=region(original);
 const removable=[
  '                  <p className="mt-2 break-words text-xs font-semibold leading-relaxed text-zinc-200">{shortAddress || \'Endereço não informado\'}</p>\n',
  '                    {!isGroupedStop && position !== undefined && <span className="rounded-lg bg-zinc-900 px-2 py-1 text-zinc-300">Parada {position}</span>}\n',
  '                    <span className="rounded-lg bg-zinc-900 px-2 py-1 text-zinc-300">{isGroupedStop ? \'Vários pedidos na parada\' : visualOrigin === \'site\' ? \'Pedido do Site\' : visualOrigin === \'ifood\' ? \'Pedido iFood\' : visualOrigin === \'food99\' ? \'Pedido 99Food\' : \'Pedido direto\'}</span>\n',
 ];
 for(const line of removable){if(exp.includes(line))exp=exp.replace(line,'');}
 assert.equal(region(card),exp,'ERRO: regiao expandida local alterada fora dos tres textos redundantes permitidos');
 console.log('OK: todo o card expandido local foi preservado (salvo rotulos redundantes exatos)');
}
console.log('DFL V112 R82-R3 — CONTRATOS COMPATIBILIDADE OK');
