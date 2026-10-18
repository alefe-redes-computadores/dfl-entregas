import { paintDflBrand, paintFittedText } from '@/lib/share-card-brand';
import { type RoutePerformanceReport } from '@/lib/route-performance';

/** Imagem de prestação de contas da rota, sem confundir venda com ganho. */
export async function buildRouteEarningsCard(report: RoutePerformanceReport): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível para gerar o comprovante.');
  const bg = ctx.createLinearGradient(0, 0, 1080, 1350);
  bg.addColorStop(0, '#0d2023'); bg.addColorStop(1, '#090c13');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 1080, 1350);
  ctx.fillStyle = '#10b981'; ctx.fillRect(0, 0, 1080, 12);
  const text = (value: string, x: number, y: number, font: string, tone = '#f8fafc', width = 880) => {
    ctx.font = font;
    ctx.fillStyle = tone;
    ctx.fillText(paintFittedText(ctx, value, width), x, y);
  };
  const panel = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;ctx.beginPath();ctx.roundRect(x,y,w,h,30);ctx.fill();
  };
  await paintDflBrand(ctx, 64, 59, 94);
  text('DFL ENTREGAS', 184, 107, '900 35px Arial', '#6ee7b7');
  text('RESUMO DO MOTOBOY', 184, 144, '700 23px Arial', '#94a3b8');
  text(report.routeName, 64, 250, '900 75px Arial', '#ffffff');
  text(report.motoboyName, 67, 299, '700 33px Arial', '#cbd5e1');
  text(`${report.date || 'Data não informada'}  •  ${report.status}`, 68, 352, '600 27px Arial', '#94a3b8');

  panel(54, 404, 972, 250, '#14262c');
  const metrics = [
    { label: 'ENTREGAS', amount: `${report.completedOrders}/${report.orders}` },
    { label: 'PARADAS FÍSICAS', amount: `${report.completedStops}/${report.stops}` },
    { label: 'TEMPO DE ROTA', amount: report.durationLabel },
  ];
  metrics.forEach((item, i) => {
    const x = 83 + i * 319;
    if (i) {ctx.fillStyle='#284047';ctx.fillRect(x-26,447,1,161);}
    text(item.label,x,467,'700 20px Arial','#9bb0bd',258);
    text(item.amount,x,548,'900 50px Arial','#f8fafc',266);
    text(i===0?'Pedidos concluídos':i===1?'Paradas concluídas':'Saída até fechamento',x,593,'600 19px Arial','#829aa5',266);
  });

  panel(54, 695, 972, 365, report.fee === null ? '#19252c' : '#0d503d');
  text(report.fee === null ? 'REMUNERAÇÃO DA ROTA' : 'GANHO CALCULADO NESTA ROTA', 89, 766, '800 27px Arial', report.fee === null ? '#cbd5e1' : '#a7f3d0');
  text(report.feeLabel, 89, 875, report.fee === null ? '900 43px Arial' : '900 78px Arial', '#ffffff', 889);
  text(report.fee === null ? 'Não ratear diária fixa entre rotas' : 'Apuração por paradas físicas concluídas', 89, 927, '600 24px Arial', '#d1fae5', 882);
  text(report.feeDetail, 89, 987, '600 24px Arial', '#cbd5e1', 882);

  ctx.fillStyle='#23363b';ctx.fillRect(64,1121,952,2);
  text('Resultado operacional, não é comprovante de pagamento.', 64, 1180, '600 24px Arial', '#94a3b8');
  text('Confira os ajustes e a liquidação no acerto diário.', 64, 1221, '600 24px Arial', '#94a3b8');
  text('DFL  •  Organização de entregas', 64, 1300, '700 24px Arial', '#6ee7b7');
  return canvas.toDataURL('image/png');
}
