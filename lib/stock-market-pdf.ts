import type { StockMarketRow } from '@/lib/stock-market-list';
import { stockMarketChecked } from '@/lib/stock-market-list';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/** PDF A4 desenhado localmente. Sem rede e sem movimentar estoque. */
const ascii = (value: string) => String(value)
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^\x20-\x7e]/g, ' ');
const pdfText = (value: string) => ascii(value).replace(/([\\()])/g, '\\$1');
const wrap = (text: string, limit: number): string[] => {
  const output: string[] = [];
  let line = '';
  for (let word of ascii(text).split(/\s+/).filter(Boolean)) {
    while (word.length > limit) {
      if (line) { output.push(line); line = ''; }
      output.push(word.slice(0, limit));
      word = word.slice(limit);
    }
    if (!word) continue;
    if (line && line.length + 1 + word.length > limit) { output.push(line); line = word; }
    else line = line ? `${line} ${word}` : word;
  }
  if (line) output.push(line);
  return output.length ? output : [''];
};
const ink = { slate: '0.10 0.14 0.20', gray: '0.38 0.42 0.47', emerald: '0.02 0.47 0.34', pale: '0.91 0.97 0.94' };
function pageHeader(lines: string[], date: string, done: number, total: number) {
  lines.push('0.065 0.087 0.12 rg 0 741 595 101 re f');
  lines.push('0.22 0.83 0.60 rg 41 780 5 29 re f');
  lines.push(`1 1 1 rg BT /FB 20 Tf 58 796 Td (${pdfText('DA FAMILIA LANCHES')}) Tj ET`);
  lines.push(`0.73 0.78 0.81 rg BT /F1 11 Tf 58 775 Td (${pdfText('LISTA DE COMPRAS - MODO MERCADO')}) Tj ET`);
  lines.push(`0.77 0.85 0.83 rg BT /F1 9 Tf 42 756 Td (${pdfText(date + '  |  ' + done + ' / ' + total + ' conferidos')}) Tj ET`);
  lines.push('0.92 0.95 0.95 rg 41 728 513 1 re f');
}
function pageFooter(lines: string[], page: number, total: number) {
  lines.push('0.87 0.90 0.90 rg 41 55 513 1 re f');
  lines.push(`${ink.gray} rg BT /F1 9 Tf 42 39 Td (${pdfText('Checklist de planejamento. A entrada no estoque exige recebimento no DFL.')}) Tj ET`);
  lines.push(`${ink.gray} rg BT /F1 9 Tf 495 39 Td (${page} / ${total}) Tj ET`);
}
export function buildStockMarketPdf(rows: readonly StockMarketRow[], checked: Readonly<Record<string, string>>, now = new Date()): string {
  const sheets: string[][] = [];
  let commands: string[] = [];
  let y = 714;
  let category = '';
  const openPage = () => { commands = []; y = 714; category = ''; };
  const closePage = () => { sheets.push(commands); openPage(); };
  openPage();
  const date = now.toLocaleDateString('pt-BR');
  for (const row of rows) {
    const nameLines = wrap(row.name, 62);
    const detailLines = wrap(row.purchaseText, 74);
    const height = 33 + (nameLines.length - 1 + detailLines.length - 1) * 12;
    const changedCategory = category !== row.category;
    if (y - height - (changedCategory ? 31 : 0) < 80) closePage();
    if (category !== row.category) {
      category = row.category;
      commands.push(`${ink.pale} rg 41 ${y - 23} 513 25 re f`);
      commands.push(`${ink.emerald} rg BT /FB 10 Tf 51 ${y - 16} Td (${pdfText(row.category.toLocaleUpperCase('pt-BR'))}) Tj ET`);
      y -= 34;
    }
    const done = stockMarketChecked(row, checked);
    commands.push(done ? `${ink.pale} rg 41 ${y - height + 6} 513 ${height - 2} re f` : '1 1 1 rg');
    commands.push(done ? `${ink.emerald} RG 1 w 50 ${y - 17} 12 12 re S` : '0.55 0.61 0.65 RG 1 w 50 ' + (y - 17) + ' 12 12 re S');
    if (done) commands.push(`0.02 0.47 0.34 RG 1.5 w 52 ${y - 11} m 55 ${y - 14} l 61 ${y - 6} l S`);
    nameLines.forEach((name, index) => {
      commands.push(`${ink.slate} rg BT /FB 10 Tf 72 ${y - 14 - index * 12} Td (${pdfText(name)}) Tj ET`);
    });
    const startDetail = y - 29 - (nameLines.length - 1) * 12;
    detailLines.forEach((line, index) => commands.push(`${ink.gray} rg BT /F1 9 Tf 72 ${startDetail - index * 12} Td (${pdfText(line)}) Tj ET`));
    y -= height;
    commands.push('0.94 0.95 0.95 rg 41 ' + (y + 1) + ' 513 0.65 re f');
  }
  closePage();
  const objects: string[] = [];
  const add = (object: string) => { objects.push(object); return objects.length; };
  const catalog = add('');
  const pages = add('');
  const regular = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const bold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const pageIds: number[] = [];
  sheets.forEach((items, index) => {
    const streamLines: string[] = [];
    pageHeader(streamLines, date, rows.filter(row => stockMarketChecked(row, checked)).length, rows.length);
    streamLines.push(...items);
    pageFooter(streamLines, index + 1, sheets.length);
    const stream = streamLines.join('\n') + '\n';
    const contentId = add(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
    pageIds.push(add(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${regular} 0 R /FB ${bold} 0 R >> >> /Contents ${contentId} 0 R >>`));
  });
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pages} 0 R >>`;
  objects[pages - 1] = `<< /Type /Pages /Kids [${pageIds.map(id => id + ' 0 R').join(' ')}] /Count ${pageIds.length} >>`;
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((item, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${item}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(n => `${String(n).padStart(10, '0')} 00000 n `).join('\n')}\n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}

/** No Android, compartilhar o ARQUIVO PDF, não um blob URL do WebView. */
export async function exportStockMarketPdf(rows: readonly StockMarketRow[], checked: Readonly<Record<string, string>>): Promise<'shared' | 'downloaded'> {
  const now = new Date();
  const name = `dfl-lista-mercado-${now.toISOString().slice(0, 10)}.pdf`;
  const pdf = buildStockMarketPdf(rows, checked, now);
  if (Capacitor.isNativePlatform()) {
    const saved = await Filesystem.writeFile({ directory: Directory.Cache, path: name, data: btoa(pdf) });
    await Share.share({ title: 'DFL - Lista de compras', text: 'Lista de compras em PDF', files: [saved.uri], dialogTitle: 'Enviar PDF para Samsung Notes' });
    return 'shared';
  }
  const blob = new Blob([pdf], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
  return 'downloaded';
}
