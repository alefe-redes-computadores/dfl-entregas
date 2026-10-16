import { findDetachedIfoodIdentifiers, type ParsedIfoodOrder } from '@/lib/ifood-order-parser';

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

export type IfoodRecognitionTone = 'identity' | 'financial' | 'logistics' | 'attention';
export type IfoodRecognitionItem = {
  key: string;
  label: string;
  tone: IfoodRecognitionTone;
};
export type IfoodFinancialBreakdown = {
  index: number;
  title: string;
  customerCharge: string;
  subsidy: string;
  total: string;
};

const money = (value: string) => value ? `R$ ${value}` : '';

export function buildIfoodRecognitionSummary(orders: ParsedIfoodOrder[]) {
  const items: IfoodRecognitionItem[] = [];
  const financial: IfoodFinancialBreakdown[] = [];
  const add = (key: string, label: string, tone: IfoodRecognitionTone) => {
    if (label && !items.some((item) => item.key === key && item.label === label)) items.push({ key, label, tone });
  };

  orders.forEach((order, index) => {
    const prefix = orders.length > 1 ? `${index + 1} · ` : '';
    add(`order-${index}`, order.orderId ? `${prefix}Pedido #${order.orderId}` : '', 'identity');
    add(`ifood-${index}`, order.ifoodId ? `${prefix}ID ${order.ifoodId}` : '', 'identity');
    add(`code-${index}`, order.confirmationCode ? `${prefix}Código ${order.confirmationCode}` : '', 'attention');
    add(`customer-${index}`, order.customerName ? `${prefix}${order.customerName}` : '', 'identity');
    add(`phone-${index}`, order.phone ? `${prefix}Telefone identificado` : '', 'logistics');
    add(`address-${index}`, order.address || order.mapsLink ? `${prefix}${order.mapsLink && !order.address ? 'Mapa identificado' : 'Endereço identificado'}` : '', 'logistics');
    add(`payment-${index}`, order.paymentMethod ? `${prefix}${order.isPaid ? 'Pago no app' : `Pagamento: ${order.paymentMethod}`}` : '', 'financial');
    add(`charge-${index}`, order.customerCharge ? `${prefix}Cliente paga ${money(order.customerCharge)}` : '', 'financial');
    add(`subsidy-${index}`, order.subsidy ? `${prefix}Cupom iFood ${money(order.subsidy)}` : '', 'financial');
    add(`change-${index}`, order.changeFor ? `${prefix}Troco para ${money(order.changeFor)}` : '', 'attention');
    add(`drinks-${index}`, order.drinks.length ? `${prefix}${order.drinks.join(', ')}` : '', 'logistics');
    add(`observations-${index}`, order.observations.length ? `${prefix}${order.observations.length} observação${order.observations.length > 1 ? 'ões' : ''}` : '', 'attention');
    add(`route-${index}`, order.routeNumber ? `${prefix}Rota ${order.routeNumber}` : '', 'logistics');
    add(`courier-${index}`, order.motoboyHint ? `${prefix}Motoboy: ${order.motoboyHint}` : '', 'logistics');
    if (order.customerCharge || order.subsidy) {
      financial.push({
        index,
        title: order.orderId ? `Pedido #${order.orderId}` : `Pedido ${index + 1}`,
        customerCharge: order.customerCharge,
        subsidy: order.subsidy,
        total: order.value,
      });
    }
  });

  return { items, financial };
}

const compact = (value: string) => value.replace(/\s+/g, ' ').trim();

export function buildIfoodParseGuide(text: string, order?: ParsedIfoodOrder): IfoodGuideItem[] {
  const raw = text || '';
  const explicitOrder = raw.match(/(?:\bpedido|n[º°o.]?\s*(?:do\s+)?pedido|#)\s*[:#-]?\s*(\d+)(?!\d)/i)?.[1] || '';
  // Header-only: amounts, phones and street numbers must not become IDs.
  const pair = raw.match(/^\s*#?(\d{1,6})[ \t]+(\d+)[ \t]*$/m);
  // V85: reconhecimento progressivo de pares em linhas separadas.
  // Apenas linhas numéricas consecutivas são elegíveis sem rótulo.
  const separated = raw.match(/(?:^|\n)\s*#?(\d{4}|\d{8})\s*\n\s*#?(\d{4}|\d{8})\s*(?=\n|$)/);
  const separateOrder = separated && separated[1].length !== separated[2].length
    ? (separated[1].length === 4 ? separated[1] : separated[2]) : '';
  const separateId = separated && separated[1].length !== separated[2].length
    ? (separated[1].length === 8 ? separated[1] : separated[2]) : '';
  const standalone = raw.trim().match(/^#?(\d{1,6})$/)?.[1] || '';
  const detached = findDetachedIfoodIdentifiers(raw);
  const orderDigits = order?.orderId || explicitOrder || pair?.[1] || separateOrder || detached?.orderId || standalone;
  const explicitId = raw.match(/\b(?:id\s*(?:ifood|do\s+ifood|do\s+pedido)?|ifood\s+id)\s*[:#-]?\s*(\d+)(?!\d)/i)?.[1] || pair?.[2] || '';
  const idDigits = order?.ifoodId || explicitId || separateId || detached?.ifoodId || '';
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
