import type { Delivery, StockMovement, StockProduct } from '@/types';
import { dateKey, deliveryDate } from '@/lib/operational-time';

export type BeverageStockSuggestion={id:string;date:string;product:StockProduct;quantity:number;deliveryIds:string[];labels:string[];confidence:'alta'|'media'};
const fold=(v:string)=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g,' ').trim();
const beverageProduct=(p:StockProduct)=>/bebida|refrigerante|agua|suco/.test(fold(p.category||''))||/coca|kuat|guarana|fanta|sprite|pepsi|agua|suco/.test(fold(p.name));
const sizeTokens=(v:string)=>{const n=fold(v);const out:string[]=[];for(const m of n.matchAll(/(\d+(?:[.,]\d+)?)\s*(l|litro|litros|ml)/g)){let x=m[1].replace(',','.');if(m[2]==='litro'||m[2]==='litros')x+= 'l';else x+=m[2];out.push(x)}return out};
const brandTokens=(v:string)=>fold(v).split(' ').filter(x=>x.length>2&&!['refrigerante','bebida','litros','litro','gratis','combo','garrafa','lata'].includes(x));
function matchProduct(label:string,products:StockProduct[]){const normalized=fold(label);const sizes=sizeTokens(label);const ranked=products.map(product=>{const name=fold(product.name);let score=0;for(const token of brandTokens(product.name))if(normalized.includes(token))score+=3;for(const size of sizes)if(name.replace(/\s/g,'').includes(size))score+=4;return{product,score}}).sort((a,b)=>b.score-a.score);return ranked[0]&&ranked[0].score>=3&&ranked[0].score>(ranked[1]?.score||-1)?ranked[0].product:null}
function quantityFor(label:string){const n=fold(label);const digit=n.match(/(?:^|\s)(\d+)\s*x?(?=\s)/);if(digit)return Math.max(1,Number(digit[1]));if(/(?:^|\s)(um|uma)(?:\s|$)/.test(n))return 1;return 1}
export function buildBeverageStockSuggestions(deliveries:Delivery[],products:StockProduct[],movements:StockMovement[],dismissed:string[]=[],now=new Date()):BeverageStockSuggestion[]{
 const today=dateKey(now);const candidates=deliveries.filter(d=>d.completed&&d.drinks?.trim()).map(d=>({d,key:deliveryDate(d)?dateKey(deliveryDate(d)!):''})).filter(x=>x.key&&x.key<today);const previous=[...new Set(candidates.map(x=>x.key))].sort().at(-1);if(!previous)return[];
 const stock=products.filter(p=>p.active&&beverageProduct(p));const grouped=new Map<string,BeverageStockSuggestion>();
 for(const {d,key} of candidates.filter(x=>x.key===previous)){for(const raw of d.drinks!.split(/\s*(?:,|;|\+|\n)\s*/).filter(Boolean)){const product=matchProduct(raw,stock);if(!product)continue;const id='beverage-review:'+key+':'+product.id;if(dismissed.includes(id)||movements.some(m=>m.id===id))continue;const old=grouped.get(id);const quantity=quantityFor(raw);if(old){old.quantity+=quantity;old.deliveryIds.push(d.id);old.labels.push(raw)}else grouped.set(id,{id,date:key,product,quantity,deliveryIds:[d.id],labels:[raw],confidence:sizeTokens(raw).length?'alta':'media'})}}
 return [...grouped.values()].sort((a,b)=>b.quantity-a.quantity||a.product.name.localeCompare(b.product.name,'pt-BR'));
}
