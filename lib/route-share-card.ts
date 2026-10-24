import type { Delivery, Route } from '@/types';
import { groupDeliveriesByStop } from '@/lib/route-stops';
import { deriveDeliveryPaymentState } from '@/lib/delivery-finance';
import { routeStartedAt } from '@/lib/operational-time';
import { firstValidTimestamp } from '@/lib/reports/time';
import { canonicalizeOperationalAddress } from '@/lib/operational-address';
import { paintDflBrand, paintFittedText } from '@/lib/share-card-brand';

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

const operationalMoney = (value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function buildRouteShareCard(
  route: Route,
  deliveries: Delivery[],
  storeAddress: string,
  explicitCoordinates?: { origin?: string | null; stops?: Record<string, string | null> },
  ifoodConfirmationMode: 'store' | 'motoboy' = 'store',
): Promise<RouteShareCard> {
  const groups = groupDeliveriesByStop(deliveries);
  const origin = explicitCoordinates?.origin || coordinates(storeAddress);
  const points = groups.map(group => explicitCoordinates?.stops?.[group.representative.id] || coordinates(group.representative.address_string || ''));
  const mapUrl = staticMapUrl(origin, points);
  let map: HTMLImageElement | null = null;
  if (mapUrl) {
    try { map = await loadImage(mapUrl); } catch { /* Sem mapa confiável: priorizar dados operacionais. */ }
  }
  const paid = deliveries.filter(item => deriveDeliveryPaymentState(item) === 'paid').length;
  const chargeable = deliveries.filter(item => deriveDeliveryPaymentState(item) !== 'paid' && item.payment_method !== 'pix');
  const pendingPix = deliveries.filter(item => deriveDeliveryPaymentState(item) !== 'paid' && item.payment_method === 'pix');
  const cardOrders = chargeable.filter(item => /cart[aã]o|cartao|cr[eé]dito|d[eé]bito/i.test(item.payment_method || ''));
  const cashOrders = chargeable.filter(item => item.payment_method === 'dinheiro');
  const pendingCodes = deliveries.filter(item => item.origin === 'ifood' && !item.confirmation_code).length;
  const ifoodOrders = deliveries.filter(item => item.origin === 'ifood');
  const ifoodVisibleOrders = ifoodOrders.slice(0, 7);
  const driverConfirmsIfood = ifoodConfirmationMode === 'motoboy' && ifoodOrders.length > 0;
  // Sem link clicável dentro do PNG: o link clicável segue no texto compartilhado.
  const ifoodPanelHeight = ifoodOrders.length ? 105 + ifoodVisibleOrders.length * 34 + (ifoodOrders.length > 7 ? 28 : 0) : 0;
  const drinkGroups = new Map<string, number>();
  for (const item of deliveries) {
    const label = (item.drinks || '').trim();
    if (!label) continue;
    drinkGroups.set(label, (drinkGroups.get(label) || 0) + 1);
  }
  const drinks = [...drinkGroups.entries()].map(([name, count]) => `${count}× ${name}`);
  const stopsHeight = groups.length * 116;
  const mapHeight = map ? 320 : 0;
  const checklistHeight = 196 + (drinks.length ? 46 + Math.min(drinks.length, 5) * 36 : 0) + (driverConfirmsIfood ? 128 : 0) + (ifoodPanelHeight ? ifoodPanelHeight + 34 : 0);
  const requestedHeight = 457 + mapHeight + 25 + stopsHeight + checklistHeight + 105;
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = Math.min(Math.max(830, requestedHeight), 8500);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível.');
  const text = (value: string, x: number, y: number, font = '700 26px Arial', color = '#e5e7eb', max = 900) => {
    ctx.font = font;ctx.fillStyle = color;ctx.fillText(paintFittedText(ctx, value, max), x, y);
  };
  const bg = ctx.createLinearGradient(0, 0, 1080, canvas.height);
  bg.addColorStop(0, '#081b1c');bg.addColorStop(1, '#090d14');
  ctx.fillStyle = bg;ctx.fillRect(0, 0, 1080, canvas.height);
  ctx.fillStyle = '#10b981';ctx.fillRect(0, 0, 1080, 11);
  await paintDflBrand(ctx, 54, 48, 88);
  text('DFL ENTREGAS', 165, 87, '900 27px Arial', '#34d399');
  text('CONFERÊNCIA DE SAÍDA', 165, 123, '700 23px Arial', '#94a3b8');
  text(route.name || 'Rota', 54, 219, '900 67px Arial', '#ffffff');
  text(`${route.motoboy_name}  •  ${deliveries.length} pedidos  •  ${groups.length} paradas`, 56, 265, '700 29px Arial', '#cbd5e1');
  const departure = firstValidTimestamp(routeStartedAt(route));
  text(`Emitida ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}${departure ? '  •  Saída ' + departure.toLocaleTimeString('pt-BR', {timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'}) : ''}`, 56, 300, '600 23px Arial', '#7b929c');
  roundBox(ctx, 48, 324, 984, 95, 23, '#13292c');
  text(`${paid} pagos`, 74, 362, '900 31px Arial', '#6ee7b7');
  text(`${chargeable.length} a cobrar`, 328, 362, '900 31px Arial', '#fbbf24');
  text(`${pendingCodes} códigos`, 675, 362, '900 31px Arial', '#93c5fd');
  text(`${pendingPix.length} Pix pendente  •  ${cashOrders.length} dinheiro  •  ${cardOrders.length} cartão`, 75, 400, '600 24px Arial', '#cbd5e1');
  let y = 457;
  if (map) {
    ctx.save();ctx.beginPath();ctx.roundRect(48, y, 984, 300, 24);ctx.clip();ctx.drawImage(map, 48, y, 984, 300);ctx.restore();
    y += 321;
  }
  text('PARADAS  /  ORDEM DE ENTREGA', 54, y, '900 28px Arial', '#34d399');y += 25;
  let skipped = 0;
  groups.forEach((group, index) => {
    if (y + 108 >= canvas.height - checklistHeight - 110) { skipped += 1; return; }
    const stop = group.representative;
    const unpaid = group.deliveries.filter(item => deriveDeliveryPaymentState(item) !== 'paid');
    const toCollect = unpaid.filter(item => item.payment_method !== 'pix');
    const pix = unpaid.filter(item => item.payment_method === 'pix');
    const collectAmount = toCollect.reduce((sum, item) => sum + Math.max(0, Number(item.customer_charge ?? item.value) || 0), 0);
    const pixAmount = pix.reduce((sum, item) => sum + Math.max(0, Number(item.customer_charge ?? item.value) || 0), 0);
    const names = [...new Set(group.deliveries.map(item => item.customer_name || '').filter(Boolean))];
    const neighborhood = canonicalizeOperationalAddress(stop.address_string || '').neighborhood || stop.address_string || 'Destino';
    const drink = group.deliveries.map(item => item.drinks?.trim()).filter(Boolean).join(' + ');
    const code = group.deliveries.some(item => item.origin === 'ifood' && !item.confirmation_code);
    const status = collectAmount > 0 ? `COBRAR ${operationalMoney(collectAmount)}` : pixAmount > 0 ? `PIX PENDENTE ${operationalMoney(pixAmount)}` : 'PAGO';
    const tone = collectAmount > 0 || pixAmount > 0 ? '#fbbf24' : '#34d399';
    roundBox(ctx, 48, y, 984, 106, 20, '#152028');
    roundBox(ctx, 62, y + 20, 64, 63, 16, '#223342');
    text(String(index + 1).padStart(2, '0'), 74, y + 63, '900 28px Arial', '#7dd3fc');
    text(neighborhood, 148, y + 41, '800 29px Arial', '#f8fafc', 580);
    text(names[0] || 'Cliente', 756, y + 41, '600 22px Arial', '#cbd5e1', 246);
    text([status, code ? 'CÓDIGO' : '', drink ? `BEBIDA: ${drink}` : ''].filter(Boolean).join('  ·  '), 148, y + 79, '700 23px Arial', tone, 820);
    y += 116;
  });
  if (skipped) {text(`+ ${skipped} paradas — detalhes no texto enviado`, 54, y + 25, '600 25px Arial', '#94a3b8');y += 43;}
  roundBox(ctx, 48, y + 10, 984, checklistHeight - 12, 25, '#10262c');
  text('ANTES DE SAIR', 76, y + 60, '900 31px Arial', '#7dd3fc');
  text(cardOrders.length ? `MAQUININHA  •  ${cardOrders.length} cobrança(s)` : 'MAQUININHA  •  não necessária', 76, y + 112, '800 26px Arial', cardOrders.length ? '#fbbf24' : '#cbd5e1');
  text(`${pendingCodes} códigos iFood  •  ${pendingPix.length} Pix a confirmar`, 76, y + 155, '700 25px Arial', '#e2e8f0');
  if (drinks.length) {
    text('BEBIDAS PARA CONFERIR', 76, y + 208, '900 26px Arial', '#34d399');
    drinks.slice(0, 5).forEach((drink, i) => text(drink, 76, y + 245 + i * 36, '700 24px Arial', '#f8fafc'));
  }
  // R88: cada pedido leva seu proprio ID e codigo; dados ausentes sao pendencias.
  if (ifoodOrders.length) {
    const panelY = y + 188 + (drinks.length ? 80 + (Math.min(drinks.length, 5) - 1) * 36 : 0);
    roundBox(ctx, 72, panelY, 935, ifoodPanelHeight + (driverConfirmsIfood ? 128 : 0), 18, driverConfirmsIfood ? '#321a23' : '#173039');
    text(driverConfirmsIfood ? 'IFOOD  /  MOTOBOY CONFIRMA' : 'IFOOD  /  LOJA CONFIRMA', 92, panelY + 32, '900 25px Arial', driverConfirmsIfood ? '#fda4af' : '#7dd3fc');
    text(driverConfirmsIfood ? 'Portal: confirmacao-entrega-propria.ifood.com.br' : 'Coletar o codigo e informar a loja', 92, panelY + 62, '700 23px Arial', '#ffffff');
    text('ID e codigo sao individuais por pedido.', 92, panelY + 87, '600 18px Arial', '#cbd5e1');
    ifoodVisibleOrders.forEach((item, index) => {
      const id = String(item.ifood_id || '').replace(/\D/g, '');
      const code = String(item.confirmation_code || '').replace(/\D/g, '');
      const number = String(item.order_id || index + 1).trim();
      const idLabel = id.length === 8 ? id : 'PENDENTE';
      const codeLabel = code.length === 4 ? code : 'PEDIR CODIGO';
      text(`#${number}   |   ID: ${idLabel}   |   CODIGO: ${codeLabel}`, 92, panelY + 116 + index * 34, '700 21px Arial', '#f8fafc', 880);
    });
    if (ifoodOrders.length > ifoodVisibleOrders.length) {
      text(`+ ${ifoodOrders.length - ifoodVisibleOrders.length} pedidos no texto completo`, 92, panelY + 116 + ifoodVisibleOrders.length * 34, '700 19px Arial', '#fdba74', 880);
    }
    // R85: reservar e usar 128 px somente quando o portal cabe ao motoboy.
    // Registrar o codigo no DFL NAO confirma a entrega na plataforma.
    if (driverConfirmsIfood) {
      const footerY = panelY + ifoodPanelHeight + 13;
      text('1  Pedir o codigo de 4 digitos ao cliente', 92, footerY + 24, '700 22px Arial', '#fef2f2', 875);
      text('2  Confirmar cada ID + codigo no portal iFood', 92, footerY + 56, '700 22px Arial', '#fef2f2', 875);
      text('Codigo salvo no DFL NAO confirma no portal', 92, footerY + 88, '700 20px Arial', '#fda4af', 875);
    }
  }
  text('DFL  •  Conferir antes de iniciar a viagem', 54, canvas.height - 42, '700 22px Arial', '#748891');
  return { dataUrl: canvas.toDataURL('image/png'), usedRealMap: Boolean(map) };
}
