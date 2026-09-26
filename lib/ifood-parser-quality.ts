import type { ParsedIfoodOrder } from '@/lib/ifood-order-parser';

export type IfoodParseQuality = {
  complete: number;
  review: number;
  issues: Array<{ index: number; fields: string[] }>;
};

export function assessIfoodParseQuality(orders: ParsedIfoodOrder[]): IfoodParseQuality {
  const issues = orders.map((order,index)=>{
    const fields:string[]=[];
    if(!order.ifoodId) fields.push('ID iFood');
    if(!order.orderId) fields.push('pedido');
    if(!order.customerName) fields.push('cliente');
    if(!order.address && !order.mapsLink) fields.push('endereço');
    return {index,fields};
  }).filter(item=>item.fields.length>0);
  return {complete:orders.length-issues.length,review:issues.length,issues};
}
