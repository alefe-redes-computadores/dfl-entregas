/** R243: renderizador de TEXTO SIMULADO, não é um driver de impressora. */
import type { SiteV3CertificationModel, SiteV3Unit } from './site-combo-v3-certification';
export type ThermalWidth = 58 | 80;

function cellWidth(cp: string): number {
  const c = cp.codePointAt(0) || 0;
  // Emoji, CJK e ideogramas ocupam duas colunas em impressoras comuns.
  return c > 0xFFFF || (c >= 0x1100 && (c <= 0x11FF || c >= 0x2E80)) ? 2 : 1;
}
export function printedColumns(line: string): number {
  return Array.from(line).reduce((width, cp) => width + cellWidth(cp), 0);
}
/** Divide sem truncar caracteres, inclusive tokens e observações sem espaços. */
export function wrapThermal(value: string, width: number, prefix = '', continued = '  '): string[] {
  if (!Number.isInteger(width) || width < 12 || width > 120 ||
    printedColumns(prefix) >= width || printedColumns(continued) >= width) throw Error('THERMAL_WIDTH_INVALID');
  const output: string[] = [];
  let line = prefix;
  for (const cp of Array.from(value)) {
    if (printedColumns(line) + cellWidth(cp) > width) {
      output.push(line);
      line = continued;
    }
    line += cp;
  }
  output.push(line);
  return output;
}
const money = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
function unitLines(unit: SiteV3Unit, width: number): string[] {
  const first = `${unit.unitNumber}/${unit.groupQuantity} ${unit.componentLabel} [${unit.key}]`;
  const lines = wrapThermal(first, width);
  for (const addon of unit.addons) lines.push(...wrapThermal(`+ ${addon.label} (${money(addon.priceCents || 0)})`, width, '  ', '  '));
  for (const removal of unit.removals) lines.push(...wrapThermal(`SEM ${removal.label}`, width, '  ', '  '));
  if (unit.note) lines.push(...wrapThermal(unit.note, width, '  OBS: ', '  '));
  if (!unit.note && !unit.addons.length && !unit.removals.length) lines.push('  PADRAO');
  return lines;
}
export function simulatedComboV3Receipt(model: SiteV3CertificationModel, width: ThermalWidth): readonly string[] {
  if (width !== 58 && width !== 80) throw Error('THERMAL_WIDTH_UNSUPPORTED');
  if (model.state !== 'certification_only' || model.canPersist !== false || model.canPrint !== false ||
    model.canRelay !== false || model.canCharge !== false) throw Error('THERMAL_OPERATION_NOT_ALLOWED');
  const columns = width === 58 ? 30 : 42;
  const result: string[] = ['NAO IMPRIMIR / NAO ENVIAR', `SIMULACAO ${width} mm`,
    `Combo: ${model.productId}`, `${model.comboCount} combo(s) | ${model.unitCount} unidade(s)`];
  for (let n=1;n<=model.comboCount;n++) {
    result.push('------------------------------'.slice(0,columns), `COMBO ${n}/${model.comboCount}`);
    for (const unit of model.units.filter(value => value.comboNumber === n)) {
      result.push(...unitLines(unit, columns));
    }
  }
  result.push('------------------------------'.slice(0,columns));
  result.push(...wrapThermal(`Base demonstrativa: ${money(model.baseForOrderCents)}`, columns));
  result.push(...wrapThermal(`Adicionais: ${money(model.extrasForOrderCents)}`, columns));
  result.push(...wrapThermal(`TOTAL DE SIMULACAO: ${money(model.totalCents)}`, columns));
  result.push('SEM PEDIDO / SEM COBRANCA');
  if (result.some(line => printedColumns(line) > columns)) throw Error('THERMAL_LINE_OVERFLOW');
  return result;
}
