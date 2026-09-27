const fs=require('fs'),r=p=>fs.readFileSync(p,'utf8');
const f={stock:r('app/estoque/page.tsx'),details:r('app/estoque/detalhes/page.tsx'),move:r('app/estoque/movimentar/page.tsx'),count:r('app/estoque/contagem/page.tsx')};
const c=[
 ['âncora DOM do produto',f.stock.includes('data-stock-product={product.id}')],
 ['scroll preservado',f.stock.includes("dfl-stock-scroll")],
 ['busca preservada',f.stock.includes("dfl-stock-query")],
 ['filtro preservado',f.stock.includes("dfl-stock-filter")],
 ['categorias preservadas',f.stock.includes("dfl-stock-collapsed")],
 ['origem chega à movimentação',f.move.includes("const from = search.get('from')")],
 ['salvar e voltar',f.move.includes('Salvar e voltar')],
 ['salvar e próximo',f.move.includes('Salvar e próximo')],
 ['próximo é local',!f.move.includes('getDocs(')&&!f.move.includes('onSnapshot(')],
 ['contagem usa sessão local',f.count.includes('dfl-stock-count-session-v2')],
 ['contagem usa API existente',f.count.includes('countStockProducts')],
 ['contagem sem Firestore direto',!f.count.includes('firebase/')&&!f.count.includes('getDocs(')],
 ['Enter avança',f.count.includes('focusNext(p.id)')],
];
let bad=0;for(const [n,ok] of c){console.log(`${ok?'OK':'ERRO'}: ${n}`);if(!ok)bad++}if(bad)process.exit(1);console.log('\nRECOVERY V2: contratos OK');
