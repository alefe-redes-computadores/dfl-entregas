import type { Delivery, Route } from '@/types';
import { groupDeliveriesByStop } from '@/lib/route-stops';
import { deriveDeliveryPaymentState } from '@/lib/delivery-finance';

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

export async function buildRouteShareCard(
  route: Route,
  deliveries: Delivery[],
  storeAddress: string,
  explicitCoordinates?: { origin?: string | null; stops?: Record<string, string | null> },
): Promise<RouteShareCard> {
  const groups = groupDeliveriesByStop(deliveries);
  const stops = groups.map(group => group.representative);
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1450;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível.');
  ctx.fillStyle = '#09090b';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  let usedRealMap = false;
  const origin = explicitCoordinates?.origin || coordinates(storeAddress);
  const stopCoordinates = stops.map((stop) => explicitCoordinates?.stops?.[stop.id] || coordinates(stop.address_string || ''));
  const url = staticMapUrl(origin, stopCoordinates);
  if (url) {
    try {
      const map = await loadImage(url);
      ctx.drawImage(map, 0, 0, 1080, 690);
      usedRealMap = true;
    } catch { /* Fallback operacional, nunca mapa fictício. */ }
  }
  if (!usedRealMap) {
    roundBox(ctx, 48, 48, 984, 600, 36, '#111c24');
    ctx.fillStyle = '#38bdf8';
    ctx.font = '900 27px Arial';
    ctx.fillText('SEQUÊNCIA OPERACIONAL', 90, 120);
    ctx.fillStyle = '#f4f4f5';
    ctx.font = '900 56px Arial';
    ctx.fillText(`${stops.length} paradas`, 90, 205);
    ctx.fillStyle = '#a1a1aa';
    ctx.font = '600 28px Arial';
    ctx.fillText('Não é um mapa geográfico.', 90, 265);
    ctx.fillText('Abra o link enviado para navegar nas ruas.', 90, 312);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(105, 352); ctx.lineTo(975, 352); ctx.stroke();
    ctx.fillStyle = '#e4e4e7';
    ctx.font = '700 29px Arial';
    ctx.fillText('Loja  →  Paradas na ordem cadastrada', 90, 415);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 26px Arial';
    ctx.fillText('Posições ilustrativas não são utilizadas.', 90, 485);
  }
  const overlay = ctx.createLinearGradient(0, 575, 0, 800);
  overlay.addColorStop(0, 'rgba(9,9,11,0)');
  overlay.addColorStop(1, '#09090b');
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 575, 1080, 225);
  ctx.fillStyle = '#38bdf8';
  ctx.font = '900 25px Arial';
  ctx.fillText('DFL ENTREGAS  ·  ROTA COMPLETA', 64, 750);
  ctx.fillStyle = '#fafafa';
  ctx.font = '900 52px Arial';
  ctx.fillText(fitText(ctx, route.name, 952), 64, 817);
  ctx.fillStyle = '#a1a1aa';
  ctx.font = '700 27px Arial';
  ctx.fillText(fitText(ctx, `${route.motoboy_name}  ·  ${deliveries.length} pedidos  ·  ${stops.length} paradas`, 952), 64, 863);
  const paid = deliveries.filter(item => deriveDeliveryPaymentState(item) === 'paid').length;
  const pendingCodes = deliveries.filter(item => item.origin === 'ifood' && !item.confirmation_code).length;
  roundBox(ctx, 48, 893, 984, 90, 20, '#17212b');
  ctx.font = '700 26px Arial';
  ctx.fillStyle = '#e2e8f0';
  ctx.fillText(`${paid} pagos  ·  ${deliveries.length - paid} a conferir  ·  ${pendingCodes} códigos pendentes`, 78, 949);
  let y = 1015;
  stops.slice(0, 5).forEach((item, index) => {
    roundBox(ctx, 48, y, 984, 61, 15, '#18181b');
    ctx.fillStyle = '#38bdf8';
    ctx.font = '900 24px Arial';
    ctx.fillText(String(index + 1).padStart(2, '0'), 72, y + 40);
    ctx.fillStyle = '#e4e4e7';
    ctx.font = '700 23px Arial';
    ctx.fillText(fitText(ctx, item.customer_name || item.address_string || 'Parada', 850), 135, y + 40);
    y += 75;
  });
  if (stops.length > 5) {
    ctx.fillStyle = '#a1a1aa';
    ctx.font = '700 23px Arial';
    ctx.fillText(`5 de ${stops.length} paradas · sequência completa na mensagem`, 64, 1410);
  }
  ctx.fillStyle = '#22c55e';
  ctx.font = '900 22px Arial';
  ctx.fillText(usedRealMap ? 'MAPA COM COORDENADAS EXPLÍCITAS' : 'SEM MAPA VALIDADO · LINK DE NAVEGAÇÃO NA MENSAGEM', 64, 1437);
  return { dataUrl: canvas.toDataURL('image/png', 0.9), usedRealMap };
}
