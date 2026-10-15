import type { StockProduct } from '@/types';
import { commercialProductStatus } from '@/lib/stock-commercial-health';

export type StockCatalogIssue={productId:string;productName:string;severity:'critical'|'attention'|'improvement';title:string;action:string;impact:string};
const norm=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g,' ').trim();
const make=(product:StockProduct,severity:StockCatalogIssue['severity'],title:string,action:string,impact:string):StockCatalogIssue=>({productId:product.id,productName:product.name,severity,title,action,impact});

export function stockCatalogIssues(products:StockProduct[]):StockCatalogIssue[]{
 const active=products.filter(product=>product.active);const names=new Map<string,StockProduct[]>();active.forEach(product=>names.set(norm(product.name),[...(names.get(norm(product.name))||[]),product]));const out:StockCatalogIssue[]=[];
 active.forEach(product=>{const current=Number(product.current_quantity),minimum=Number(product.minimum_quantity),ideal=Number(product.ideal_quantity||0),lead=Number(product.lead_time_days),cost=Number(product.average_cost||0);const presentations=(product.presentations||[]).filter(item=>item.active);const commercialStatus=commercialProductStatus(product);
  if(!Number.isFinite(current)||current<0)out.push(make(product,'critical','Saldo inválido','Faça uma contagem física e corrija o saldo.','Bloqueia uma recomendação de compra confiável.'));
  if(!Number.isFinite(minimum)||minimum<0)out.push(make(product,'critical','Mínimo inválido','Informe um nível mínimo maior ou igual a zero.','O alerta de ruptura deixa de representar o estoque real.'));
  if(ideal>0&&ideal<minimum)out.push(make(product,'critical','Meta abaixo do mínimo','Ajuste “Repor até” para igual ou acima do mínimo.','A compra pode terminar sem retirar o produto da zona de risco.'));
  if(minimum<=0&&ideal<=0)out.push(make(product,'attention','Sem regra de reposição','Defina quando avisar e até onde repor.','O produto não entra nas sugestões automáticas de compra.'));
  else if(minimum>0&&ideal<=minimum)out.push(make(product,'improvement','Meta sem margem','Considere uma meta acima do mínimo para cobrir o próximo ciclo.','Qualquer consumo após a compra pode recolocar o item em atenção.'));
  if(!String(product.category||'').trim())out.push(make(product,'attention','Categoria ausente','Escolha a categoria física correta.','Busca, agrupamento e relatórios ficam menos úteis.'));
  if(!Number.isFinite(lead)||lead<0)out.push(make(product,'attention','Prazo de reposição inválido','Informe quantos dias a compra costuma demorar.','A inteligência não sabe quando antecipar a compra.'));
  if(!(cost>0))out.push(make(product,'improvement','Custo médio ausente','Informe um custo ou registre uma compra recebida.','Valor em estoque e comparação de preços ficam incompletos.'));
  if((names.get(norm(product.name))||[]).length>1&&(names.get(norm(product.name))||[])[0]?.id===product.id)out.push(make(product,'attention','Possível produto duplicado','Compare saldo, unidade e histórico antes de arquivar.','Dois cadastros dividem consumo, custo e recomendação.'));
  if(commercialStatus==='invalid_presentation')out.push(make(product,'critical','Apresentação comercial incompleta','Corrija nome, unidade e conteúdo da embalagem.','A quantidade de compra pode ser arredondada incorretamente.'));
  if(commercialStatus==='fractional_without_presentation')out.push(make(product,'attention','Forma de compra ausente','Cadastre a embalagem usada na compra.','A falta física é conhecida, mas não quantas embalagens comprar.'));
  const keys=presentations.map(item=>`${norm(item.label)}:${item.purchase_unit}:${Number(item.conversion_quantity)}`);if(new Set(keys).size<keys.length)out.push(make(product,'attention','Apresentações repetidas','Mantenha apenas uma forma para cada embalagem equivalente.','A escolha automática pode mostrar opções redundantes.'));
 });
 const rank={critical:0,attention:1,improvement:2} as const;return out.sort((a,b)=>rank[a.severity]-rank[b.severity]||a.productName.localeCompare(b.productName,'pt-BR'));
}
