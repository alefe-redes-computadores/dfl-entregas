const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
const read=f=>fs.readFileSync(f,'utf8');let count=0;
const ok=(v,title)=>{assert.ok(v,title);count++};
const nav=read('components/layout/BottomNav.tsx');
ok(nav.includes("pathname === '/'"),'home contextual');
ok(nav.includes("pathname === '/loja'"),'loja contextual');
ok(nav.includes("label: 'Caixa de entrada'") && nav.includes("label: 'Novo pedido'"),'botao da loja');
const create=read('app/entregas/nova/page.tsx');
ok(create.includes("setIsParserOpen(false);")&&create.includes('Rascunho carregado da Caixa de Entrada'),'caixa preenche e recolhe leitor');
ok(create.includes('99Food · dados reconhecidos') && create.includes('isFood99 ?'), '99Food leitor especializado');
ok(create.includes('marketplaceModes?.food99') && create.includes('marketplaceModes?.ifood'),'modalidades por canal');
const store=read('store/useAppStore.ts');
ok(store.includes('marketplaceDeliveryModes')&&store.includes('motoboyConfirmsIfood'),'configuracoes e fila iFood');
ok(store.includes('!motoboyConfirmsIfood'),'nao abrir pendencia para motoboy que confirma');
const f=read('components/motoboys/MotoboyForm.tsx');
ok(f.includes('setIfoodMode') && f.includes('ifood_confirmation_mode:ifoodMode'),'formulario de motoboy');
const card=read('components/home/DeliveryCard.tsx');
ok(card.includes("ifoodConfirmationMode !== 'motoboy'"),'captura de codigo por motoboy');
ok(card.includes('flex flex-col gap-2 border-t border-zinc-800/40 pt-2'),'acoes de parada com espaco');
const conf=read('app/confirmacoes/page.tsx');
ok(conf.includes('selfConfirmRouteIds'),'central filtra responsabilidade do motoboy');
const c=read('components/home/OperationalCommandCenter.tsx');
ok(c.includes('selfConfirmRouteIds'),'alertas iFood seguem regra');
const loja=read('app/loja/page.tsx');
ok(loja.includes('Entrega por plataforma') && loja.includes('Caixa de Entrada') && loja.includes("router.push('/loja/caixa-de-entrada')") && nav.includes("label: 'Caixa de entrada'"),'loja funcional: configuracao e navegacao reais');
const report=read('app/relatorios/page.tsx');
ok(report.includes('<OriginChart data=')&&read('components/reports/Charts/OriginChart.tsx').includes('leadingPercent'),'novo grafico por canal');
// R75-R2: phone mask must be input-preserving for every incremental digit.
const vm=require('node:vm');const phoneModule={exports:{}};
vm.runInNewContext(ts.transpileModule(read('lib/phone.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:phoneModule,exports:phoneModule.exports});
const {formatBrazilPhone,normalizeBrazilPhone}=phoneModule.exports;
for (const n of ['34987654321','3498765432']) {let shown='';for(const digit of n) {shown=formatBrazilPhone(shown+digit);assert.equal(shown.replace(/\D/g,''),n.slice(0,shown.replace(/\D/g,'').length));}assert.equal(shown.replace(/\D/g,''),n);count++;}
ok(normalizeBrazilPhone('3498765432')==='34998765432','DDD + oito digitos e normalizado somente ao salvar');
ok(formatBrazilPhone('+55 (34) 98765-4321')==='(34) 98765-4321','numero colado com DDI nao perde digitos');
ok(create.includes('isSyncing && !hasHydrated') && create.includes('findOrCreateCustomer'),'sync em segundo plano nao bloqueia formulario hidratado');
ok(create.includes('Bebidas')&&create.includes('99Food · dados reconhecidos'),'99Food identifica bebidas junto ao cliente e pagamento');
for(const file of ['components/layout/BottomNav.tsx','components/motoboys/MotoboyForm.tsx','components/home/DeliveryCard.tsx','app/entregas/nova/page.tsx','app/loja/page.tsx','app/relatorios/page.tsx','app/confirmacoes/page.tsx','app/loja/caixa-de-entrada/page.tsx']){
 const s=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(s.parseDiagnostics.length,0,`TSX syntax: ${file}`);count++;
}
console.log('R75-R2 MACRO: '+count+' verificacoes aprovadas');
