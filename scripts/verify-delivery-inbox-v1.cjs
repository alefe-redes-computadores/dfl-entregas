const fs=require('fs');

const checks=[
  ['lib/delivery-inbox.ts',[
    'DELIVERY_INBOX_PREFIX',
    'findInboxDuplicate',
    'createInboxDraft',
    'markInboxDraft'
  ]],
  ['app/loja/caixa-de-entrada/page.tsx',[
    'Caixa de Entrada',
    'Analisar pedidos',
    'Possível duplicado',
    'ainda não lançado'
  ]],
  ['app/loja/page.tsx',[
    "router.push('/loja/caixa-de-entrada')",
    'Caixa de Entrada',
    'minimumSample: 5',
    'highlightLimit: 2'
  ]],
  ['app/entregas/nova/page.tsx',[
    'inboxDraftId',
    'loadInboxDay',
    'markInboxDraft'
  ]]
];

let bad=0;

for(const [file,needles] of checks){
  if(!fs.existsSync(file)){
    console.error('AUSENTE:',file);
    bad++;
    continue;
  }

  const source=fs.readFileSync(file,'utf8');

  for(const needle of needles){
    if(!source.includes(needle)){
      console.error('FALHOU:',file,'->',needle);
      bad++;
    }
  }
}

if(bad) process.exit(1);

console.log('OK: Caixa de Entrada Inteligente V1');
console.log('OK: cérebro da Loja menos ruidoso');
