import type { Delivery, Route } from '@/types';
import { groupDeliveriesByStop } from '@/lib/route-stops';
import { deriveDeliveryPaymentState } from '@/lib/delivery-finance';
import { routeStartedAt } from '@/lib/operational-time';
import { firstValidTimestamp } from '@/lib/reports/time';
import { canonicalizeOperationalAddress } from '@/lib/operational-address';

export type RouteShareCard = { dataUrl: string; usedRealMap: boolean };

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('Mapa estático indisponível'));
  image.src = src;
});

// Nunca geocodificar endereços incompletos para produzir uma imagem que parece precisa.
// Só utilizamos o mapa quando TODAS as paradas e a loja têm coordenadas explícitas.
function coordinates(value: string): string | null {
  const match = value.trim().match(/^(-?\d{1,2}\.\d{3,}),\s*(-?\d{1,3}\.\d{3,})$/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? `${lat},${lng}` : null;
}

function staticMapUrl(origin: string | null, stopCoordinates: Array<string | null>): string {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  const points = [origin, ...stopCoordinates].map((point) => point ? coordinates(point) : null);
  if (!key || !stopCoordinates.length || points.some(point => !point)) return '';
  const params = new URLSearchParams({ size: '640x640', scale: '2', maptype: 'roadmap', key });
  params.append('markers', `color:0x22c55e|label:L|${points[0]}`);
  points.slice(1, 21).forEach((point, index) => params.append('markers', `color:0x0ea5e9|label:${index < 9 ? index + 1 : String.fromCharCode(56 + index)}|${point}`));
  // Não desenhar linhas retas fingindo que representam ruas ou a rota percorrida.
  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

function roundBox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let trimmed = text;
  while (trimmed.length > 1 && ctx.measureText(`${trimmed}…`).width > maxWidth) trimmed = trimmed.slice(0, -1);
  return `${trimmed}…`;
}

const operationalMoney = (value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function buildRouteShareCard(
  route: Route,
  deliveries: Delivery[],
  storeAddress: string,
  explicitCoordinates?: { origin?: string | null; stops?: Record<string, string | null> },
): Promise<RouteShareCard> {
  const groups = groupDeliveriesByStop(deliveries);
  const canvas = document.createElement('canvas');
  const width = 1080;
  const height = Math.max(1450, 900 + groups.length * 108 + 340);
  canvas.width = width;
  canvas.height = Math.min(height, 6000);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível.');
  const paint = (value: string, x: number, y: number, font = '700 26px Arial', color = '#e5e7eb', max = 900) => {
    ctx.font = font; ctx.fillStyle = color; ctx.fillText(fitText(ctx, value, max), x, y);
  };
  const surface = ctx.createLinearGradient(0, 0, 1080, canvas.height);
  surface.addColorStop(0, '#09151e'); surface.addColorStop(1, '#09090b');
  ctx.fillStyle = surface; ctx.fillRect(0, 0, width, canvas.height);
  paint('DFL  /  ENTREGAS', 54, 76, '900 29px Arial', '#38bdf8');
  paint(route.name, 54, 163, '900 65px Arial', '#f8fafc');
  paint(`${route.motoboy_name}  ·  ${deliveries.length} pedidos  ·  ${groups.length} paradas`, 56, 211, '700 28px Arial', '#cbd5e1');
  const departure = firstValidTimestamp(routeStartedAt(route));
  const now = new Date();
  const displayTime = departure || now;
  paint(`${departure ? 'Saída' : 'Imagem emitida'}: ${displayTime.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`, 56, 251, '600 25px Arial', '#94a3b8');

  const paid = deliveries.filter(item => deriveDeliveryPaymentState(item) === 'paid').length;
  const cardOrders = deliveries.filter(item => deriveDeliveryPaymentState(item) !== 'paid' && item.payment_method?.includes('cartao'));
  const cashOrders = deliveries.filter(item => deriveDeliveryPaymentState(item) !== 'paid' && item.payment_method === 'dinheiro');
  const pendingCodes = deliveries.filter(item => item.origin === 'ifood' && !item.confirmation_code).length;
  const drinkOrders = deliveries.filter(item => Boolean(item.drinks?.trim())).length;
  roundBox(ctx, 48, 278, 984, 105, 22, '#172533');
  paint(`${paid} pagos  ·  ${deliveries.length - paid} pendentes  ·  ${pendingCodes} códigos`, 76, 321, '800 29px Arial', '#f8fafc');
  paint(`${cardOrders.length} cartão  ·  ${cashOrders.length} dinheiro  ·  ${drinkOrders} pedidos com bebida`, 76, 361, '700 25px Arial', '#cbd5e1');

  let y = 425;
  const origin = explicitCoordinates?.origin || coordinates(storeAddress);
  const points = groups.map(group => explicitCoordinates?.stops?.[group.representative.id] || coordinates(group.representative.address_string || ''));
  const mapUrl = staticMapUrl(origin, points);
  let usedRealMap = false;
  if (mapUrl) {
    try {
      const map = await loadImage(mapUrl);
      roundBox(ctx, 48, y, 984, 370, 20, '#17212b');
      ctx.save(); ctx.beginPath(); ctx.roundRect(48, y, 984, 370, 20); ctx.clip();
      ctx.drawImage(map, 48, y, 984, 370); ctx.restore();
      usedRealMap = true;
      y += 395;
    } catch { /* Sem mapa: os dados operacionais seguem disponíveis. */ }
  }
  paint('PARADAS  /  ORDEM DE ENTREGA', 54, y + 20, '900 28px Arial', '#38bdf8');
  y += 46;
  groups.forEach((group, index) => {
    if (y + 98 >= canvas.height - 340) return;
    const stop = group.representative;
    const unpaid = group.deliveries.filter(item => deriveDeliveryPaymentState(item) !== 'paid');
    const amount = unpaid.reduce((sum, item) => sum + Math.max(0, Number(item.customer_charge ?? item.value) || 0), 0);
    const names = [...new Set(group.deliveries.map(item => item.customer_name || '').filter(Boolean))];
    const neighborhood = canonicalizeOperationalAddress(stop.address_string || '').neighborhood || stop.address_string || 'Destino';
    const drinks = group.deliveries.map(item => item.drinks?.trim()).filter(Boolean).join(' + ');
    const code = group.deliveries.some(item => item.origin === 'ifood' && !item.confirmation_code);
    const status = unpaid.length ? (unpaid.every(item => item.payment_method === 'pix') ? `PIX PENDENTE ${operationalMoney(amount)}` : `RECEBER ${operationalMoney(amount)}`) : 'PAGO';
    roundBox(ctx, 48, y, 984, 94, 16, '#181f29');
    paint(String(index + 1).padStart(2, '0'), 72, y + 42, '900 29px Arial', '#38bdf8', 60);
    paint(neighborhood, 140, y + 38, '800 28px Arial', '#f8fafc', 540);
    paint(names[0] || 'Cliente', 715, y + 38, '700 23px Arial', '#cbd5e1', 270);
    paint(`${status}${code ? '  ·  CÓDIGO' : ''}${drinks ? `  ·  BEBIDA: ${drinks}` : ''}`, 140, y + 76, '700 22px Arial', unpaid.length ? '#fbbf24' : '#34d399', 850);
    y += 108;
  });
  if (y + 98 >= canvas.height - 340) {
    paint('Continue a sequência na mensagem compartilhada.', 54, y + 25, '700 24px Arial', '#94a3b8');
    y += 45;
  }
  const footerY = Math.min(Math.max(y + 20, canvas.height - 260), canvas.height - 250);
  roundBox(ctx, 48, footerY, 984, 188, 20, '#14212b');
  paint('ANTES DE SAIR', 76, footerY + 43, '900 29px Arial', '#38bdf8');
  paint(cardOrders.length ? `MAQUININHA: ${cardOrders.length} cobrança(s) · ${operationalMoney(cardOrders.reduce((sum, item) => sum + Number(item.customer_charge ?? item.value ?? 0), 0))}` : 'Cartão: nenhuma cobrança na entrega', 76, footerY + 91, '700 25px Arial', cardOrders.length ? '#fbbf24' : '#d1d5db');
  paint(`Conferir ${drinkOrders} pedido(s) com bebida e ${pendingCodes} código(s)`, 76, footerY + 133, '700 25px Arial', '#e2e8f0');
  paint(usedRealMap ? 'MAPA DE COORDENADAS VALIDADAS' : 'CHECKLIST OPERACIONAL', 58, canvas.height - 27, '800 22px Arial', '#64748b');
  return { dataUrl: canvas.toDataURL('image/png'), usedRealMap };
}
