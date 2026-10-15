import type { ParsedIfoodOrder } from '@/lib/ifood-order-parser';

export type IfoodParseQuality = {
  complete: number;
  review: number;
  issues: Array<{ index: number; fields: string[] }>;
};

export type IfoodGuideState = 'missing' | 'partial' | 'complete';
export type IfoodGuideItem = {
  key: 'order' | 'ifood' | 'customer' | 'address' | 'payment';
  label: string;
  state: IfoodGuideState;
  value: string;
  hint: string;
};

const compact = (value: string) => value.replace(/\s+/g, ' ').trim();

export function buildIfoodParseGuide(text: string, order?: ParsedIfoodOrder): IfoodGuideItem[] {
  const raw = text || '';
  const explicitOrder = raw.match(/(?:\bpedido|n[º°o.]?\s*(?:do\s+)?pedido|#)\s*[:#-]?\s*(\d+)(?!\d)/i)?.[1] || '';
  // Header-only: amounts, phones and street numbers must not become IDs.
  const pair = raw.match(/^\s*#?(\d{1,6})[ \t]+(\d+)[ \t]*$/m);
  const standalone = raw.trim().match(/^#?(\d{1,6})$/)?.[1] || '';
  const orderDigits = order?.orderId || explicitOrder || pair?.[1] || standalone;
  const explicitId = raw.match(/\b(?:id\s*(?:ifood|do\s+ifood|do\s+pedido)?|ifood\s+id)\s*[:#-]?\s*(\d+)(?!\d)/i)?.[1] || pair?.[2] || '';
  const idDigits = order?.ifoodId || explicitId;
  const customerDraft = raw.match(/(?:cliente|nome)\s*:\s*([^\n]*)/i)?.[1]?.trim() || '';
  const hasAddressCue = /\b(?:rua|r\.|avenida|av\.|travessa|alameda)\b/i.test(raw);
  const hasPaymentCue = /\b(?:pago|pix|dinheiro|cart[aã]o|troco|maquininha)\b/i.test(raw);

  return [
    {
      key: 'order', label: 'Pedido',
      state: /^\d{3,6}$/.test(orderDigits) ? 'complete' : orderDigits ? 'partial' : 'missing',
      value: order?.orderId ? `#${order.orderId}` : orderDigits ? `#${orderDigits}` : '',
      hint: orderDigits ? 'Continue até 3–6 dígitos' : 'Ex.: #1234',
    },
    {
      key: 'ifood', label: 'ID iFood',
      state: /^\d{8}$/.test(idDigits) ? 'complete' : idDigits ? 'partial' : 'missing',
      value: order?.ifoodId || idDigits,
      hint: idDigits.length > 8 ? 'Confira: o ID deve ter 8 dígitos' : idDigits ? `Faltam ${Math.max(0, 8-idDigits.length)} dígitos` : '8 dígitos',
    },
    {
      key: 'customer', label: 'Cliente',
      state: order?.customerName ? 'complete' : customerDraft ? 'partial' : 'missing',
      value: order?.customerName || customerDraft,
      hint: customerDraft ? 'Continue o nome' : 'Nome ou “Cliente: ...”',
    },
    {
      key: 'address', label: 'Endereço',
      state: order?.address || order?.mapsLink ? 'complete' : hasAddressCue ? 'partial' : 'missing',
      value: compact(order?.address || (order?.mapsLink ? 'Link do Maps' : '')),
      hint: hasAddressCue ? 'Inclua número e bairro' : 'Rua, número e bairro',
    },
    {
      key: 'payment', label: 'Pagamento',
      state: order?.paymentMethod ? 'complete' : hasPaymentCue ? 'partial' : 'missing',
      value: order?.paymentMethod ? (order.isPaid ? 'Pago no app' : order.paymentMethod) : '',
      hint: hasPaymentCue ? 'Informe valor/estado' : 'Pago, Pix, dinheiro ou cartão',
    },
  ];
}

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
