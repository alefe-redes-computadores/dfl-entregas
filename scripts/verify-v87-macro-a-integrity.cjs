const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const Module=require('node:module');
const read=(file)=>fs.readFileSync(file,'utf8');
const ok=(value,label)=>{if(!value)throw new Error(`V87 A: ${label}`);console.log('OK:',label)};

const authoritySource=read('lib/motoboy-settlement-authority.ts');
const js=ts.transpileModule(authoritySource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod=new Module('v87-settlement',module);mod.filename=process.cwd()+'/lib/motoboy-settlement-authority.ts';mod.paths=module.paths;mod._compile(js,mod.filename);
const {settlementSourceId,settlementDocumentId,pendingAdjustmentsForSettlement,settlementAdjustmentSnapshot}=mod.exports;
assert.equal(settlementSourceId('m1','2026-10-15'),'motoboy:m1:2026-10-15');
assert.equal(settlementDocumentId('motoboy:m1:2026-10-15'),'settlement-motoboy:m1:2026-10-15');
const adjustments=[
 {id:'a1',motoboy_id:'m1',operational_date:'2026-10-15',status:'pending',kind:'meal',description:'Lanche',amount:15},
 {id:'a2',motoboy_id:'m1',operational_date:'2026-10-15',status:'incorporated',kind:'fuel',description:'Gasolina',amount:20},
 {id:'a3',motoboy_id:'m2',operational_date:'2026-10-15',status:'pending',kind:'advance',description:'Pix',amount:10},
];
assert.deepEqual(pendingAdjustmentsForSettlement(adjustments,'m1','2026-10-15').map(x=>x.id),['a1']);
assert.deepEqual(settlementAdjustmentSnapshot([adjustments[0]])[0],{id:'a1',kind:'meal',direction:undefined,category_id:undefined,category_label:undefined,description:'Lanche',amount:15});
console.log('OK: ajuste pendente entra uma vez e snapshot não mistura metadados');

const store=read('store/useAppStore.ts');
const types=read('types/index.ts');
const time=read('lib/operational-time.ts');
const analytics=read('lib/motoboy-analytics.ts');
const page=read('app/motoboys/acerto/page.tsx');
ok(types.includes("MotoboyAdjustmentStatus = 'pending' | 'cancelled' | 'incorporated'"),'estados financeiros explícitos');
ok(store.includes("incrementalCollection(\n              'motoboy_adjustments'")&&store.includes('motoboyAdjustments: mergeById'),'ajustes sincronizam incrementalmente');
ok(store.includes('const adjustmentSnapshots = []')&&store.indexOf('transaction.get(settlementRef)')<store.indexOf('transaction.set(settlementRef'),'transação lê conflitos antes de escrever');
ok(store.includes("status: 'incorporated'")&&store.includes('settlement_source_id: expense.source_id'),'incorporação é atômica e rastreável');
ok(store.includes('Acerto fechado é imutável') && store.includes('isClosedSettlement(remote)') && store.includes('transaction.delete(ref)'), 'acerto fechado protege edição e exclusão inclusive no servidor');
ok(time.includes('routeOperationalDateKey')&&store.includes('operational_date: route.operational_date || dateKey'),'competência é canônica desde a criação da rota');
ok(analytics.includes('route.operational_date?route.operational_date===date'),'analytics prioriza competência persistida');
ok(page.includes('Rascunho antigo sincronizado')&&page.includes('localStorage.removeItem(draftKey)'),'rascunho local antigo possui reconciliação segura');
ok(page.includes('closeMotoboySettlement')&&page.includes('sharedAdjustments.map(item=>item.id)'),'tela fecha com IDs compartilhados');
ok(!page.includes('Excluir lançamento')&&page.includes('Fechado e protegido'),'ação destrutiva saiu do caminho principal');
ok(!store.includes("collection(db, 'motoboy_settlement_claims')"),'coleção experimental permanece ausente');
console.log('\nV87 MACROCIRURGIA A: CONTRATOS OK');
