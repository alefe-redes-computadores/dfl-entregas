/**
 * DFL Entregas R243 — parsing ESTRITAMENTE ISOLADO do candidato R249 do Site.
 * NÃO importar em siteOrderPersistence, endpoint, outbox, checkout ou impressora.
 * Os campos de preço são apenas conferidos contra o documento de demonstração;
 * NUNCA equivalem a consulta ao catálogo/preço do servidor ou autorização.
 */
export const SITE_COMBO_V3_CERTIFICATION_ONLY = true as const;
export const SITE_COMBO_V3_LIVE_RECEIVER_ENABLED = false as const;
export const SITE_COMBO_V3_PRINTER_ENABLED = false as const;
export const SITE_COMBO_V3_CANDIDATE_CONTRACT = 'dfl_site_combo_order_v3_candidate' as const;

const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;
const UNIT_KEY = /^c([1-9][0-9]*):([1-9][0-9]*):([1-9][0-9]*)$/;
const UNSAFE = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/;
const LIMIT_CENTS = 150_000_000;
type Obj = Record<string, unknown>;
const object = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
function fail(reason: string): never { throw Error(`SITE_COMBO_V3_CERT_${reason}`); }
function ensure(ok: unknown, reason: string): asserts ok { if (!ok) fail(reason); }
function exact(value: unknown, names: readonly string[], reason: string): asserts value is Obj {
  ensure(object(value), reason);
  const actual = Object.keys(value);
  ensure(actual.length === names.length && actual.every(key => names.includes(key)), reason);
}
function integer(v: unknown, max = LIMIT_CENTS): v is number {
  return typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= max;
}
function identifier(v: unknown): v is string { return typeof v === 'string' && ID.test(v); }
function label(v: unknown, max = 100, allowEmpty = false): v is string {
  return typeof v === 'string' && v.length <= max && !UNSAFE.test(v) && (allowEmpty || v.trim().length > 0);
}
function sum(left: number, right: number, code: string): number {
  const value = left + right;
  ensure(integer(value), code);
  return value;
}

export type SiteV3Option = Readonly<{ id: string; label: string; priceCents?: number }>;
export type SiteV3Unit = Readonly<{
  key: string; comboNumber: number; componentId: string; componentLabel: string;
  unitNumber: number; groupQuantity: number; addons: readonly SiteV3Option[];
  removals: readonly SiteV3Option[]; note: string; extrasCents: number;
}>;
export type SiteV3CertificationModel = Readonly<{
  state: 'certification_only'; orderSchemaVersion: 3;
  canPersist: false; canRelay: false; canCharge: false; canPrint: false;
  productId: string; comboCount: number; unitCount: number;
  customizedUnitCount: number; baseForOrderCents: number;
  extrasForOrderCents: number; totalCents: number;
  units: readonly SiteV3Unit[];
}>;

/** Fail-closed, sem conversão silenciosa de campos desconhecidos. */
export function inspectSiteComboV3Candidate(raw: unknown): SiteV3CertificationModel {
  exact(raw, ['contract','orderSchemaVersion','state','authorization','orderId','eventId',
    'idempotencyKey','source','productId','blueprintFingerprint','comboCount','unitCount',
    'customizedUnitCount','item','receiptPreview','acceptance'], 'ROOT_FIELDS');
  ensure(raw.contract === SITE_COMBO_V3_CANDIDATE_CONTRACT && raw.orderSchemaVersion === 3 &&
    raw.state === 'certification_only' && raw.source === 'admin_authenticated_server_quote', 'CONTRACT');
  ensure(raw.orderId === null && raw.eventId === null && raw.idempotencyKey === null, 'LIVE_IDENTITY_FORBIDDEN');
  exact(raw.authorization, ['checkout','payment','persist','relay','print','production'], 'AUTH_FIELDS');
  ensure(Object.values(raw.authorization).every(v => v === false), 'AUTH_NOT_OFF');
  ensure(identifier(raw.productId) && typeof raw.blueprintFingerprint === 'string' &&
    /^v2-[a-f0-9]{8}$/.test(raw.blueprintFingerprint), 'PRODUCT_IDENTITY');
  ensure(integer(raw.comboCount, 30) && raw.comboCount > 0 &&
    integer(raw.unitCount, 1800) && raw.unitCount > 0 &&
    integer(raw.customizedUnitCount, 1800) && raw.customizedUnitCount <= raw.unitCount, 'COUNTS');

  exact(raw.receiptPreview, ['widths','printAuthorized','preview58','preview80'], 'PREVIEW_FIELDS');
  const widths = raw.receiptPreview.widths;
  ensure(Array.isArray(widths) && widths.length === 2 && widths[0] === 58 && widths[1] === 80 &&
    raw.receiptPreview.printAuthorized === false, 'PREVIEW_AUTH');
  for (const key of ['preview58','preview80'] as const) {
    const list = raw.receiptPreview[key];
    ensure(Array.isArray(list) && list.length > 0 && list.length <= 8000 &&
      list.every(v => label(v, 150, true)) && list.some(v => v.includes('NAO IMPRIMIR')), 'PREVIEW_NOT_SAFE');
  }

  exact(raw.acceptance, ['priceRecomputedOnServer','perUnitIdentityReconciled','legacyCheckoutIntact',
    'receiverV3Supported','canonicalOrderPersistenceTested','signedRelayWithUnitFieldsTested',
    'physicalPrinterTested','liveCheckoutReleased','status','blockers'], 'ACCEPTANCE_FIELDS');
  ensure(raw.acceptance.priceRecomputedOnServer === true &&
    raw.acceptance.perUnitIdentityReconciled === true && raw.acceptance.legacyCheckoutIntact === true &&
    raw.acceptance.receiverV3Supported === false && raw.acceptance.canonicalOrderPersistenceTested === false &&
    raw.acceptance.signedRelayWithUnitFieldsTested === false && raw.acceptance.physicalPrinterTested === false &&
    raw.acceptance.liveCheckoutReleased === false && raw.acceptance.status === 'blocked' &&
    Array.isArray(raw.acceptance.blockers) && raw.acceptance.blockers.length >= 5 &&
    raw.acceptance.blockers.every(v => label(v, 100)), 'ACCEPTANCE_NOT_BLOCKED');

  exact(raw.item, ['productId','quantity','lineKind','basePricePerComboCents','baseForOrderCents',
    'extrasForOrderCents','totalCents','units'], 'ITEM_FIELDS');
  const item = raw.item;
  ensure(item.productId === raw.productId && item.quantity === raw.comboCount &&
    item.lineKind === 'combo_with_independent_units', 'ITEM_IDENTITY');
  ensure(integer(item.basePricePerComboCents, 5_000_000) && integer(item.baseForOrderCents) &&
    integer(item.extrasForOrderCents) && integer(item.totalCents) &&
    item.basePricePerComboCents * raw.comboCount === item.baseForOrderCents &&
    sum(item.baseForOrderCents, item.extrasForOrderCents, 'PRICE_OVERFLOW') === item.totalCents,
    'ITEM_TOTAL');
  ensure(Array.isArray(item.units) && item.units.length === raw.unitCount &&
    item.units.length <= 1800, 'UNIT_COUNT');

  const units: SiteV3Unit[] = [];
  const uniqueKeys = new Set<string>();
  const groups = new Map<string, { id: string; label: string; count: number; indices: Set<number> }>();
  let extras = 0, customized = 0;
  for (const entry of item.units) {
    exact(entry, ['key','comboNumber','componentId','componentLabel','unitNumber',
      'groupQuantity','addons','removals','note','extrasCents'], 'UNIT_FIELDS');
    ensure(typeof entry.key === 'string' && UNIT_KEY.test(entry.key) && !uniqueKeys.has(entry.key), 'UNIT_KEY');
    uniqueKeys.add(entry.key);
    const match = UNIT_KEY.exec(entry.key)!;
    const combo = Number(match[1]), component = Number(match[2]), ordinal = Number(match[3]);
    ensure(integer(entry.comboNumber, 30) && entry.comboNumber === combo && combo <= raw.comboCount &&
      integer(component, 1800) && integer(ordinal, 1800) &&
      entry.unitNumber === ordinal && integer(entry.groupQuantity, 30) &&
      ordinal <= entry.groupQuantity && identifier(entry.componentId) &&
      label(entry.componentLabel), 'UNIT_POSITION');
    ensure(label(entry.note, 140, true) && integer(entry.extrasCents), 'UNIT_NOTE_PRICE');
    const key = `${combo}:${component}`;
    const prior = groups.get(key);
    if (prior) {
      ensure(prior.id === entry.componentId && prior.label === entry.componentLabel &&
        prior.count === entry.groupQuantity, 'GROUP_CHANGED');
      prior.indices.add(ordinal);
    } else {
      groups.set(key, {id:entry.componentId,label:entry.componentLabel,
        count:entry.groupQuantity,indices:new Set([ordinal])});
    }
    ensure(Array.isArray(entry.addons) && entry.addons.length <= 20 &&
      Array.isArray(entry.removals) && entry.removals.length <= 20, 'UNIT_OPTIONS');
    const addonIds = new Set<string>(), removalIds = new Set<string>();
    const addons: SiteV3Option[] = [], removals: SiteV3Option[] = [];
    let itemExtras = 0;
    for (const value of entry.addons) {
      exact(value, ['id','label','priceCents'], 'ADDON_FIELDS');
      ensure(identifier(value.id) && !addonIds.has(value.id) && label(value.label) &&
        integer(value.priceCents, 1_000_000), 'ADDON');
      addonIds.add(value.id);
      itemExtras = sum(itemExtras, value.priceCents, 'ADDON_OVERFLOW');
      addons.push({ id:value.id, label:value.label, priceCents:value.priceCents });
    }
    for (const value of entry.removals) {
      exact(value, ['id','label'], 'REMOVAL_FIELDS');
      ensure(identifier(value.id) && !removalIds.has(value.id) && label(value.label), 'REMOVAL');
      removalIds.add(value.id);
      removals.push({ id:value.id, label:value.label });
    }
    ensure(itemExtras === entry.extrasCents, 'UNIT_EXTRAS');
    extras = sum(extras, itemExtras, 'EXTRAS_OVERFLOW');
    if (addons.length || removals.length || entry.note.length > 0) customized++;
    units.push({key:entry.key,comboNumber:combo,componentId:entry.componentId,
      componentLabel:entry.componentLabel,unitNumber:ordinal,groupQuantity:entry.groupQuantity,
      addons,removals,note:entry.note,extrasCents:itemExtras});
  }
  ensure(groups.size > 0, 'NO_GROUPS');
  const perCombo = new Array<number>(raw.comboCount).fill(0);
  for (const [key, group] of groups) {
    ensure(group.indices.size === group.count &&
      Array.from({ length:group.count }, (_, n) => n+1).every(n => group.indices.has(n)), 'UNIT_GAP');
    perCombo[Number(key.split(':')[0])-1] += group.count;
  }
  ensure(perCombo.every(value => value === perCombo[0]) && perCombo[0] > 0 &&
    extras === item.extrasForOrderCents && customized === raw.customizedUnitCount,
    'RECONCILIATION');
  // Mesmo combo repetido mantém a identidade e o tamanho dos componentes.
  // Adicionais, remoções e observações continuam individualizados por unidade.
  const template = new Map<string, {id:string;label:string;count:number}>();
  for (const [key, group] of groups) {
    const [combo, component] = key.split(':');
    if (combo === '1') template.set(component, group);
  }
  for (const [key, group] of groups) {
    const [combo, component] = key.split(':');
    if (combo === '1') continue;
    const original = template.get(component);
    ensure(!!original && original.id === group.id && original.label === group.label &&
      original.count === group.count, 'REPEATED_COMBO_COMPONENT');
  }
  ensure(groups.size === template.size * raw.comboCount, 'REPEATED_COMBO_MISSING_COMPONENT');
  return {state:'certification_only',orderSchemaVersion:3,canPersist:false,canRelay:false,
    canCharge:false,canPrint:false,productId:raw.productId,comboCount:raw.comboCount,
    unitCount:raw.unitCount,customizedUnitCount:customized,
    baseForOrderCents:item.baseForOrderCents,extrasForOrderCents:extras,totalCents:item.totalCents,units};
}
