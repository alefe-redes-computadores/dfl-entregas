// lib/stock-categories.ts
export const DEFAULT_STOCK_CATEGORIES=['Açougue','Bebidas','Embalagens','Gás','Hortifrúti','Limpeza','Molhos e condimentos','Padaria','Outros'] as const;
export type StockCategoryIconKey='beef'|'cup'|'package'|'flame'|'leaf'|'sparkles'|'soup'|'bread'|'boxes';
const norm=(v:string)=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('pt-BR');
export function stockCategoryIconKey(category?:string):StockCategoryIconKey{
 const v=norm(category||'');
 if(/acougue|carne|hamburg/.test(v))return 'beef';
 if(/bebida|refrigerante|suco|agua/.test(v))return 'cup';
 if(/embalagem|caixa|sacola|papel/.test(v))return 'package';
 if(/gas|botijao/.test(v))return 'flame';
 if(/horti|verdura|legume|fruta/.test(v))return 'leaf';
 if(/limpeza|higiene/.test(v))return 'sparkles';
 if(/molho|condimento|tempero/.test(v))return 'soup';
 if(/padaria|pao|panifica/.test(v))return 'bread';
 return 'boxes';
}
