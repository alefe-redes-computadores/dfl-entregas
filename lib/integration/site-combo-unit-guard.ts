/**
 * DFL ENTREGAS R242 — fail-closed boundary for Site order schemas and per-unit combo fields.
 * O Site publica orderSchemaVersion 3 com itens ainda compatíveis com a estrutura
 * flat. Aceitar V3 NÃO habilita personalização por unidade: campos unit-level
 * continuam bloqueados, sem achatamento/perda da escolha do cliente.
 *
 * This guard does not create orders, mutate data, or advertise a new capability.
 */
export const SITE_COMBO_UNIT_PRODUCTION_SUPPORTED = false as const;
export const SITE_LEGACY_ORDER_SCHEMA_MAX = 3 as const;

const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const unitField = /^(?:comboUnit[A-Za-z0-9_]*|comboCustomization|comboUnits|unitCustomization|unitCustomizations|unitSelections|unitOverrides|unitPlan|unitLines|unitChoices|unit_customizations|unit_choices|perUnit[A-Za-z0-9_]*)$/i;
const previewContract = 'dfl_site_combo_units_preview_v1';

/** Read-only detection, bounded to avoid pathological payload traversal. */
export function legacySiteOrderCanPreserveContent(raw: unknown): boolean {
  if (!record(raw)) return false;
  const schema = raw.orderSchemaVersion;
  if (typeof schema !== 'number' || !Number.isInteger(schema) || schema < 1 || schema > SITE_LEGACY_ORDER_SCHEMA_MAX) return false;
  const stack: Array<{ value: unknown; depth: number }> = [{ value: raw, depth: 0 }];
  const seen = new Set<object>();
  let scanned = 0;
  while (stack.length) {
    const next = stack.pop()!;
    const value = next.value;
    if (value === null || typeof value !== 'object') continue;
    if (seen.has(value)) continue;
    seen.add(value);
    if (++scanned > 8_000 || next.depth > 8) return false;
    if (Array.isArray(value)) {
      if (value.length > 5_000) return false;
      for (const item of value) if (item && typeof item === 'object') stack.push({value:item,depth:next.depth+1});
      continue;
    }
    if (!record(value)) return false;
    if (value.contract === previewContract || value.status === 'preview_only') return false;
    const entries = Object.entries(value);
    if (entries.length > 250) return false;
    for (const [key, field] of entries) {
      if (unitField.test(key)) return false;
      if (field && typeof field === 'object') stack.push({value:field,depth:next.depth+1});
    }
  }
  return true;
}
