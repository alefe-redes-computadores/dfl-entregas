/** Identidade compartilhada das imagens. Usa o logotipo real do app, com fallback vetorial. */
export async function paintDflBrand(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): Promise<void> {
  ctx.fillStyle = '#0f302b';
  ctx.beginPath(); ctx.roundRect(x, y, size, size, Math.round(size * .27)); ctx.fill();
  try {
    const logo = new Image();
    const loaded = new Promise<void>((resolve, reject) => {
      logo.onload = () => resolve();
      logo.onerror = () => reject(new Error('Logotipo indisponível'));
    });
    logo.src = '/brand/dfl-entregas.png';
    await loaded;
    ctx.save();ctx.beginPath();ctx.roundRect(x, y, size, size, Math.round(size * .27));ctx.clip();
    ctx.drawImage(logo, x, y, size, size);ctx.restore();
  } catch {
    ctx.fillStyle = '#34d399';ctx.font = `900 ${Math.round(size * .37)}px Arial`;
    ctx.textAlign = 'center';ctx.fillText('DFL', x + size / 2, y + size * .64);ctx.textAlign = 'left';
  }
}

export function paintFittedText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let value = text;
  while (value.length > 1 && ctx.measureText(`${value}…`).width > maxWidth) value = value.slice(0, -1);
  return `${value}…`;
}
