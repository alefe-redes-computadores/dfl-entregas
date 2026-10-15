import type { Delivery, Route } from '@/types';
import { cleanAddressForMaps } from '@/lib/maps';
import { groupDeliveriesByStop } from '@/lib/route-stops';

export type RouteShareCard = { dataUrl: string; usedRealMap: boolean };

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image(); image.crossOrigin = 'anonymous'; image.onload = () => resolve(image); image.onerror = reject; image.src = src;
});

function staticMapUrl(origin: string, stops: Delivery[]) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  if (!key || !stops.length) return '';
  const locations = [origin, ...stops.map(item => cleanAddressForMaps(item.address_string))];
  const params = new URLSearchParams({ size: '640x640', scale: '2', maptype: 'roadmap', key });
  params.append('markers', `color:0x22c55e|label:L|${locations[0]}`);
  stops.slice(0, 20).forEach((item, index) => params.append('markers', `color:0x0ea5e9|label:${index < 9 ? index + 1 : String.fromCharCode(56 + index)}|${cleanAddressForMaps(item.address_string)}`));
  params.append('path', `color:0x0ea5e9ff|weight:5|${locations.slice(0, 21).join('|')}`);
  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

function box(ctx: CanvasRenderingContext2D, x:number,y:number,w:number,h:number,r:number){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}

export async function buildRouteShareCard(route: Route, deliveries: Delivery[], storeAddress: string): Promise<RouteShareCard> {
  const stops=groupDeliveriesByStop(deliveries).map(group=>group.representative);const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1350;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas indisponível.');ctx.fillStyle='#09090b';ctx.fillRect(0,0,1080,1350);let usedRealMap=false;const url=staticMapUrl(storeAddress,stops);
  if(url)try{const map=await loadImage(url);ctx.drawImage(map,0,0,1080,760);usedRealMap=true}catch{/* fallback sem rede/chave */}
  if(!usedRealMap){ctx.fillStyle='#0c1820';ctx.fillRect(0,0,1080,760);ctx.strokeStyle='#183342';ctx.lineWidth=18;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(80,640);ctx.bezierCurveTo(280,510,250,170,500,260);ctx.bezierCurveTo(720,340,710,600,1000,130);ctx.stroke();stops.slice(0,12).forEach((_,index)=>{const x=145+(index%4)*250,y=590-Math.floor(index/4)*190;ctx.fillStyle='#38bdf8';ctx.beginPath();ctx.arc(x,y,32,0,Math.PI*2);ctx.fill();ctx.fillStyle='#082f49';ctx.font='900 28px Arial';ctx.textAlign='center';ctx.fillText(String(index+1),x,y+10);});}
  const gradient=ctx.createLinearGradient(0,520,0,850);gradient.addColorStop(0,'rgba(9,9,11,0)');gradient.addColorStop(1,'#09090b');ctx.fillStyle=gradient;ctx.fillRect(0,520,1080,340);ctx.textAlign='left';ctx.fillStyle='#38bdf8';ctx.font='900 25px Arial';ctx.fillText('DFL ENTREGAS · ROTA COMPARTILHADA',64,720);ctx.fillStyle='#fafafa';ctx.font='900 58px Arial';ctx.fillText(route.name,64,792);ctx.fillStyle='#a1a1aa';ctx.font='700 28px Arial';ctx.fillText(`${route.motoboy_name} · ${deliveries.length} pedidos · ${stops.length} paradas`,64,838);
  let y=900;stops.slice(0,6).forEach((item,index)=>{ctx.fillStyle='#18181b';box(ctx,48,y,984,58,18);ctx.fillStyle='#38bdf8';ctx.font='900 24px Arial';ctx.fillText(String(index+1).padStart(2,'0'),72,y+38);ctx.fillStyle='#e4e4e7';ctx.font='700 23px Arial';ctx.fillText((item.customer_name||item.address_string||'Parada').slice(0,58),128,y+38);y+=70;});if(stops.length>6){ctx.fillStyle='#71717a';ctx.font='700 22px Arial';ctx.fillText(`+ ${stops.length-6} paradas no link completo`,64,y+12);}ctx.fillStyle='#22c55e';ctx.font='900 24px Arial';ctx.fillText(usedRealMap?'MAPA REAL · SEQUÊNCIA NUMERADA':'PRÉVIA OFFLINE · LINK REAL NA MENSAGEM',64,1300);return{dataUrl:canvas.toDataURL('image/png',.92),usedRealMap};
}
