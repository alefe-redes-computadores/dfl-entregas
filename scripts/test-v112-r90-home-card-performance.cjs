#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
let checks=0;
function ok(condition,message){assert.ok(condition,'R90: '+message);console.log('OK R90:',message);checks++;}
function read(f){return fs.readFileSync(f,'utf8')}
const files=[
 'app/page.tsx',
 'components/home/ClosedRoutesSection.tsx',
 'components/home/LazyClosedRouteCard.tsx',
 'components/home/DeliveryCard.tsx',
 'scripts/pre-apk.cjs',
];
for(const f of files){
 const text=read(f);
 if(!f.endsWith('.cjs')){
   const tree=ts.createSourceFile(f,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
   ok(tree.parseDiagnostics.length===0,`TSX válido ${f}`);
 }
}
const home=read('app/page.tsx');
const closed=read('components/home/ClosedRoutesSection.tsx');
const lazy=read('components/home/LazyClosedRouteCard.tsx');
const card=read('components/home/DeliveryCard.tsx');
const pre=read('scripts/pre-apk.cjs');
// Paginação limita montagem, jamais a contagem financeira e operacional.
ok(home.includes('useState(8)'),'Home inicia com oito pedidos comerciais');
ok(home.includes('storeOrdersDoDia.slice(0, storeOrdersVisibleLimit).map('),'somente oito cards comerciais iniciais são montados');
ok(home.includes('setStoreOrdersVisibleLimit((limit) => limit + 12)'),'pedidos restantes são acessíveis progressivamente');
ok(home.includes('storeOrdersDoDia.length > storeOrdersVisibleLimit'),'botão aparece apenas quando existem pedidos ocultos');
ok(home.includes('[selectedDateKey, globalMotoboy]'),'limite reinicia quando período ou filtro muda');
ok(home.includes('const faturamentoTotal = ordersDoDia.reduce('),'faturamento inclui a lista total, não a fatia visual');
ok(home.includes('const pickupCount =')&&home.includes('const counterCount =')&&home.includes('const platformCount ='),'contagem de todas as modalidades preservada');
ok(home.includes('isPrivacyMode')&&home.includes('Faturamento do período'),'privacidade mantida no painel');
// Histórico leve, só monta quando necessário e preserva acesso aos detalhes.
ok(closed.includes('recentFirst.slice(0, visibleLimit)'),'histórico mantém paginação de rotas');
ok(closed.includes('setVisibleLimit(limit => limit + 10)'),'histórico completo pode ser alcançado');
ok(closed.includes('motoboyByName.get(name)'),'agrupamento dos motoboys preservado');
ok(closed.includes('<LazyClosedRouteCard key={route.id} route={route} />'),'rotas fechadas usam preview de custo reduzido');
ok(!closed.includes('<RouteAccordion'),'histórico recolhido não monta accordion pesado');
ok(lazy.includes('memo(function LazyClosedRouteCard'),'prévia memoizada por rota');
ok(lazy.includes('if (showDetails)'),'accordion é montado somente quando usuário solicita');
ok(lazy.includes('<RouteAccordion route={route} defaultOpen={true} />'),'todos os detalhes antigos continuam acessíveis');
ok(lazy.includes('setShowDetails(false)'),'recolher desmonta o accordion e libera os recursos');
ok(!lazy.includes('useAppStore')&&!lazy.includes('onSnapshot')&&!lazy.includes('getDocs('),'prévia não cria listener Firestore/Zustand adicional');
ok(lazy.includes('aria-expanded={false}')&&lazy.includes('aria-expanded={true}'),'histórico com estado acessível');
// Gesto segue semântica R82; animação agora limitada a um frame visual.
ok(card.includes('swipeFrameRef = useRef<number | null>(null)'),'um único quadro de animação ativo por cartão');
ok(card.includes('if (swipeFrameRef.current === null)'),'eventos de toque coalescidos');
ok(card.includes('window.requestAnimationFrame'),'transform é aplicado no ritmo da tela');
ok(card.includes('window.cancelAnimationFrame(swipeFrameRef.current)'),'frame agendado é cancelado ao terminar ou interromper');
ok(card.includes('useEffect(() => () => {'),'desmontagem também cancela frames pendentes');
ok(card.includes('style.willChange = \'auto\'')&&card.includes('style.willChange = \'transform\''),'camada GPU só durante gesto horizontal');
ok(card.includes('translate3d(${swipeOffsetRef.current}px,0,0)'),'composição acelerada na movimentação');
ok(card.includes('if (Math.abs(dx) < 88 || Math.abs(dx) <= Math.abs(dy) * 1.5) return;'),'limiar e proteção contra gesto diagonal preservados');
ok(card.includes("if (dx < 0 && wasComplete) void handleTriggerAction('complete')")&&card.includes("if (dx > 0) void handleTriggerAction('expand')"),'baixa e expansão preservam suas direções');
ok(card.includes('touchAction: \'pan-y\''),'rolagem vertical do Android preservada');
ok(card.includes('onTouchCancel={handleTouchCancel}'),'cancelamento de gestos continua seguro');
ok(!lazy.includes('firebase')&&!home.includes('collection(db,')&&!card.includes('collection(db,'),'sem consultas Firestore adicionais');
const scripts=[...pre.matchAll(/^\s*'(scripts\/[^']+\.cjs)'/gm)].map(m=>m[1]);
ok(pre.includes("'scripts/test-v112-r90-home-card-performance.cjs'"),'contrato R90 registrado no pré-APK');
ok(scripts.length>200&&new Set(scripts).size===scripts.length,'pré-APK preserva lista de testes sem duplicatas');
for(const tag of ['r85-message-policy','r86-form-feedback','r87-operational-cards','r88-home-settlement','r89-performance'])ok(pre.includes(tag),`contratos ${tag} preservados`);
console.log(`V112 R90: ${checks} contratos de Home, histórico e gesto aprovados.`);
