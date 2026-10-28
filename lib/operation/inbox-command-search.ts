import type {DeliveryInboxDraft} from '@/lib/delivery-inbox';

export function normalizeInboxSearch(value:string){
 return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();
}

export function searchInboxDrafts<T extends Pick<DeliveryInboxDraft,'id'|'source'|'parsed'|'status'|'duplicateDeliveryId'>>(rows:readonly T[],query:string):T[]{
 const search=normalizeInboxSearch(query);
 if(!search)return [...rows];
 return rows.filter(d=>normalizeInboxSearch([
  d.id,d.source,d.status,d.parsed.customerName,d.parsed.phone,d.parsed.address,
  d.parsed.orderId,d.parsed.ifoodId,d.duplicateDeliveryId
 ].filter(Boolean).join(' ')).includes(search));
}

export function inboxAttentionCounts(rows:readonly Pick<DeliveryInboxDraft,'status'|'duplicateDeliveryId'>[]){
 return rows.reduce((a,d)=>{
  if(d.status==='review')a.review++;
  if(d.status==='ready')a.ready++;
  if(d.duplicateDeliveryId&&d.status!=='discarded'&&d.status!=='launched')a.duplicates++;
  return a;
 },{review:0,ready:0,duplicates:0});
}
