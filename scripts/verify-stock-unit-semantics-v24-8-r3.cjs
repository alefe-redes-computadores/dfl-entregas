const fs=require('fs');
const read=f=>fs.readFileSync(f,'utf8');
const ok=(v,m)=>{if(!v)throw Error(`V24.8 R3: ${m}`);console.log('OK:',m)};
const editor=read('components/stock/StockPresentationEditor.tsx');
const sem=read('lib/stock-unit-semantics-v24-8.ts');
const edit=read('app/estoque/editar/page.tsx');
const intelligence=read('lib/stock-intelligence.ts');

ok(editor.includes('Unidade de conteúdo')&&editor.includes('Unidade de conteúdo bloqueada'),'editor separa embalagem comercial da unidade física');
ok(editor.includes('PURCHASE.map'),'forma de compra continua selecionável');
ok(!editor.includes('<select\n         value={inputUnit}'),'select genérico da unidade contida foi removido');
ok(editor.includes('Aceita gramas e converte para kg.')&&editor.includes('Aceita ml e converte para litros.'),'massa e volume preservam conversão humana');
ok(sem.includes("'migration_candidate'")&&sem.includes('base_em_embalagem_comercial'),'motor classifica base comercial sem migrar automaticamente');
ok(sem.includes('rotulo_fardo_unidade_comercial_incorreta')&&sem.includes('rotulo_caixa_unidade_comercial_incorreta'),'motor detecta apresentação comercial incoerente');
ok(sem.includes('convertPhysicalQuantity')&&sem.includes('toFixed(6)'),'motor possui conversão numérica determinística');
ok(edit.includes('disabled={hasHistory}'),'unidade com histórico continua bloqueada nesta etapa');
ok(intelligence.includes("movement.type !== 'saida'")&&intelligence.includes('if (movement.supply_id) return false'),'cérebro continua excluindo entradas/estornos da demanda');
console.log('\nV24.8 R3 UNIDADE FÍSICA: CONTRATOS OK');
