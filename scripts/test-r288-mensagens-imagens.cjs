const fs=require('fs');
const assert=require('assert').strict;
const ts=require('typescript');
const files=[
  'types/index.ts', 'components/motoboys/MotoboyForm.tsx',
  'components/home/RouteAccordion.tsx', 'components/home/DeliveryCard.tsx', 'lib/whatsapp.ts',
  'lib/route-share-card.ts', 'lib/operation/driver-message-policy.ts',
];
let n=0;
const ok=(expr,label)=>{assert.ok(expr,label);n++;};
const read=p=>fs.readFileSync(p,'utf8');
for(const p of files){
  const ast=ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  ok(ast.parseDiagnostics.length===0,'AST '+p+': '+ast.parseDiagnostics.map(x=>x.messageText));
}
const policySource=read('lib/operation/driver-message-policy.ts');
const mod={exports:{}};
new Function('module','exports',ts.transpileModule(policySource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(mod,mod.exports);
const {driverCollectionInstruction:action,driverStopCollectionLabel:stop,driverMessageDetailMode:mode}=mod.exports;
for(const [args,word] of [
  [['pix',82,false], 'Cobrar R$ 82,00 no Pix'],
  [['cartao_debito',35,false], 'na maquininha'],
  [['dinheiro',6,false,50], 'troco R$ 44,00'],
  [['pix',82,true], 'Pago'],
])ok(action(...args).includes(word),'cobrança '+word);
ok(mode('compact')==='compact' && mode('guided')==='guided' && mode(undefined)==='compact','modo compacto padrão e orientado explícito');
ok(stop([{payment_method:'pix',amount:82}]).includes('COBRAR NO PIX R$ 82,00'),'imagem Pix não se limita a status pendente');
ok(stop([{payment_method:'cartao',amount:20}]).includes('NA MAQUININHA'),'imagem cartão aciona maquininha');
ok(stop([{payment_method:'pix',amount:20},{payment_method:'dinheiro',amount:6}]).includes('CONFERIR FORMAS'),'imagem de parada mista não inventa forma única');
ok(stop([])==='PAGO','imagem pago real');
const form=read('components/motoboys/MotoboyForm.tsx');
ok(form.includes('message_detail_mode:messageDetailMode') && form.includes("setMessageDetailMode('guided')") && form.includes("setMessageDetailMode('compact')"),'cadastro persiste preferência por motoboy');
const route=read('components/home/RouteAccordion.tsx');
ok(route.includes('motoboyObj?.message_detail_mode') && (route.match(/generateRouteMessages\(route, pendingDeliveries, storeAddr, getCustomerById, getPreviousRoute\(\), ifoodConfirmationMode, messageDetailMode\)/g)||[]).length===3,'rota propaga modo em três ações');
ok(route.includes('}, ifoodConfirmationMode, messageDetailMode)'),'imagem recebe modo do motoboy');
const card=read('components/home/DeliveryCard.tsx');
ok(card.includes('message_detail_mode') && card.includes('ifoodConfirmationMode, messageDetailMode'),'mensagens individuais recebem modo da rota');
const wa=read('lib/whatsapp.ts');
ok(wa.includes('const compactChecklist: string[] = []')&&wa.includes("messageDetailMode === 'guided' ? msg2 : compactChecklist"),'checklist compacto separado do tutorial');
ok(wa.includes('driverCollectionInstruction(') && wa.includes('Cobrar ${value} no Pix') && wa.includes('Cobrar ${value} na maquininha'),'cobrança orienta Pix e maquininha');
ok(wa.includes("messageDetailMode === 'guided'") && wa.includes('Confirme cada ID iFood individualmente no portal:'),'cópia por pedido reduz tutorial para experientes');
ok(!wa.includes('https://wa.me/55${clientPhone}?text=${gateMsg}') && !wa.includes('https://wa.me/${clientPhone.replace'),'URLs de WhatsApp com texto codificado não poluem entrega');
ok(wa.includes('stopsNeedingCode.push') && wa.includes('ifoodPortalLines(deliveries, true)'),'códigos por pedido e confirmação no portal preservados');
ok(wa.includes('buildRouteChangePlan(') && wa.includes('expectedPhysicalReturn'),'caixa e troco seguem cálculo canônico');
const image=read('lib/route-share-card.ts');
ok(image.includes('driverStopCollectionLabel(') && image.includes("driverConfirmsIfood && messageDetailMode === 'guided'"),'imagem usa ação de cobrança e instruções só no modo orientado');
ok(image.includes('ifoodVisibleOrders.forEach')&&image.includes('CODIGO: ${codeLabel}')&&image.includes('ID: ${idLabel}'),'imagem mantém IDs/códigos individuais');
const pkg=read('scripts/pre-apk.cjs');
ok(pkg.includes("'scripts/test-r288-mensagens-imagens.cjs'"),'gate R288 obrigatório no PRE-APK');
console.log(`R288 MENSAGENS PREMIUM: ${n} verificações estruturais e casos financeiros aprovados`);
