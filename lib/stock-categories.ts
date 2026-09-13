// lib/stock-categories.ts
export const DEFAULT_STOCK_CATEGORIES = [
  'Açougue',
  'Frios',
  'Congelados',
  'Mercearia',
  'Padaria / Panificação',
  'Hortifrúti',
  'Bebidas',
  'Molhos e condimentos',
  'Embalagens',
  'Limpeza e higiene',
  'Gás',
  'Outros',
] as const;

export type StockCategoryIconKey =
  | 'beef'
  | 'cup'
  | 'package'
  | 'flame'
  | 'leaf'
  | 'sparkles'
  | 'soup'
  | 'bread'
  | 'snowflake'
  | 'cheese'
  | 'boxes';

export type StockCategoryTone =
  | 'rose'
  | 'amber'
  | 'sky'
  | 'emerald'
  | 'violet'
  | 'orange'
  | 'lime'
  | 'cyan'
  | 'zinc';

const norm=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('pt-BR');

export function canonicalStockCategory(category?:string):string{
  const value=norm(category||'');
  if(!value)return'Outros';
  if(/ingrediente/.test(value))return'Mercearia';
  if(/acougue|carne|frango|linguic/.test(value))return'Açougue';
  if(/hamburg/.test(value))return'Congelados';
  if(/salsich|bacon|frio|latic|queijo|presunto|mussarela|manteiga|requeij/.test(value))return'Frios';
  if(/congel|batata.*congel|polpa/.test(value))return'Congelados';
  if(/padaria|pao|panifica/.test(value))return'Padaria / Panificação';
  if(/horti|verdura|legume|fruta|alface|tomate|cebola/.test(value))return'Hortifrúti';
  if(/bebida|refrigerante|suco|agua|cerveja/.test(value))return'Bebidas';
  if(/molho|condimento|tempero|maionese|ketchup|mostarda/.test(value))return'Molhos e condimentos';
  if(/embalagem|caixa|sacola|papel|copo|canudo|marmita|guardanapo/.test(value))return'Embalagens';
  if(/limpeza|higiene|detergente|desinfet|sabao|esponja/.test(value))return'Limpeza e higiene';
  if(/gas|botijao/.test(value))return'Gás';
  if(/mercearia|mantimento|oleo|acucar|sal|farinha|milho|ervilha|batata palha/.test(value))return'Mercearia';
  const exact=DEFAULT_STOCK_CATEGORIES.find((item)=>norm(item)===value);
  return exact||category?.trim()||'Outros';
}

export function stockProductCategory(
  _productName?: string,
  category?: string,
): string {
  // A categoria persistida é a classificação atual escolhida pelo usuário.
  // O nome serve apenas para sugestão/migração de legado.
  return canonicalStockCategory(category);
}

export function suggestStockCategory(productName?:string):string{
  const value=norm(productName||'');
  if(!value)return'Mercearia';
  if(/hamburg/.test(value))return'Congelados';
  if(/file.*frango|frango.*file|peito.*frango/.test(value))return'Açougue';
  if(/salsich|bacon|mussarela|presunto|apresuntado/.test(value))return'Frios';
  if(/batata palha|milho verde|milho/.test(value))return'Mercearia';
  const inferred=canonicalStockCategory(value);
  return inferred===value||inferred==='Outros'?'Mercearia':inferred;
}

export function stockCategoryIconKey(category?:string):StockCategoryIconKey{
  const value=norm(canonicalStockCategory(category));
  if(/acougue/.test(value))return'beef';
  if(/frio/.test(value))return'cheese';
  if(/congel/.test(value))return'snowflake';
  if(/bebida/.test(value))return'cup';
  if(/embalagem/.test(value))return'package';
  if(/gas/.test(value))return'flame';
  if(/horti/.test(value))return'leaf';
  if(/limpeza/.test(value))return'sparkles';
  if(/molho/.test(value))return'soup';
  if(/padaria/.test(value))return'bread';
  return'boxes';
}

export function stockCategoryTone(category?:string):StockCategoryTone{
  const value=norm(canonicalStockCategory(category));
  if(/acougue/.test(value))return'rose';
  if(/frio/.test(value))return'sky';
  if(/congel/.test(value))return'cyan';
  if(/mercearia/.test(value))return'amber';
  if(/padaria/.test(value))return'orange';
  if(/horti/.test(value))return'emerald';
  if(/bebida/.test(value))return'violet';
  if(/molho/.test(value))return'lime';
  if(/gas/.test(value))return'orange';
  return'zinc';
}

export function stockCategoryOrder(category?:string){
  const canonical=canonicalStockCategory(category);
  const index=DEFAULT_STOCK_CATEGORIES.findIndex((item)=>item===canonical);
  return index===-1?DEFAULT_STOCK_CATEGORIES.length:index;
}
