const fs=require('fs');
const path='app/motoboys/acerto/page.tsx';
const s=fs.readFileSync(path,'utf8');

const checks=[
  ['título semântico central',s.includes('const settlementTitle=')],
  ['explicação semântica central',s.includes('const settlementExplanation=')],
  ['loja com motoboy',s.includes('VALOR DA LOJA COM')],
  ['frase ficou com dinheiro',s.includes('ficou com R$')],
  ['dívida inversa explícita',s.includes('A loja ainda deve R$')],
  ['acerto zerado explícito',s.includes('Nenhum valor ficou pendente')],
  ['WhatsApp usa resultado central',s.includes('`${settlementExplanation}`') || s.includes('settlementExplanation')],
  ['canvas usa título central',s.includes("ctx.fillText(settlementTitle.slice")],
  ['canvas usa explicação central',s.includes("ctx.fillText(settlementExplanation.slice")],
  ['detalhe sem segundo negativo',s.includes("detail(`${adjustmentKindLabel(item.kind)}")],
  ['total abatimentos único',s.includes("row('Abatimentos',`- R$ ${money(data.totalVales)}`")],
  ['prévia explicita total',s.includes('Total dos abatimentos')],
  ['líquido sem ambiguidade',s.includes('Líquido do motoboy')],
];

let failed=0;
for(const [name,ok] of checks){
  console.log(`${ok?'OK':'ERRO'}: ${name}`);
  if(!ok)failed++;
}

if(s.includes("detail(`${adjustmentKindLabel(item.kind)} · ${item.description.slice(0,25)}`,`- R$")){
  console.error('ERRO: detalhe do abatimento ainda parece uma segunda subtração');
  failed++;
}else{
  console.log('OK: composição do abatimento não repete sinal negativo');
}

if(failed){
  console.error(`\\n${failed} contrato(s) falharam.`);
  process.exit(1);
}
console.log('\\nACERTO SEMÂNTICA FINAL: contratos OK');
