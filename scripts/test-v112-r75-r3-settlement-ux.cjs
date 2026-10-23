const fs=require('node:fs'),assert=require('node:assert/strict');
const read=file=>fs.readFileSync(file,'utf8');
let count=0;const ok=(value,description)=>{assert.ok(value,description);count++};
const settlement=read('app/motoboys/acerto/page.tsx');
ok(settlement.includes('pendingRemoval')&&settlement.includes('role="alertdialog"'),'dialogo proprio para excluir ajuste');
ok(!settlement.includes('window.confirm('),'exclusao nao depende do modal generico do navegador');
ok(settlement.includes('cancelMotoboyAdjustment(pendingRemoval.id)'),'exclusao usa autoridade existente');
ok(settlement.includes('removalBusy')&&settlement.includes('setPendingRemoval(null)'),'estado impede duplo toque e fecha corretamente');
ok(settlement.includes('showAdjustmentForm')&&settlement.includes('aria-expanded={showAdjustmentForm}'),'editor de ajuste pode ser recolhido');
ok(settlement.includes('settlementStrategy')&&settlement.includes('closeMotoboySettlement('),'tres estrategias e persistencia preservadas');
ok(settlement.includes('data.physicalDeliveryCount')&&settlement.includes('data.orderCount'),'pedidos e paradas fisicas seguem distintos');
const equipe=read('app/equipe/page.tsx');
ok(!equipe.includes('Abrir acerto de')&&equipe.includes('router.push(`/motoboys/details?id='),'acesso ao acerto pela ficha, sem CTA duplicado na Equipe');
ok(equipe.includes('/mais/acessos')&&equipe.includes('Cadastro de pessoas não concede acesso'),'equipe nao concede permissions silenciosamente');
const loja=read('app/loja/page.tsx');
ok(!loja.includes('activeMotoboys.slice(0,3)')&&loja.includes("router.push('/equipe')"),'Loja premium sem fileira de botoes de acerto');
const parse=require('typescript');for(const path of ['app/motoboys/acerto/page.tsx','app/equipe/page.tsx']){
 const sf=parse.createSourceFile(path,read(path),parse.ScriptTarget.Latest,true,parse.ScriptKind.TSX);
 assert.equal(sf.parseDiagnostics.length,0,`Sintaxe TSX: ${path}`);count++;
}
console.log(`R75-R3 ACERTO + ACESSOS: ${count} garantias aprovadas`);
