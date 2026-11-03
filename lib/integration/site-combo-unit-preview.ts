/**
 * DFL ENTREGAS R242 — isolated, READ-ONLY consumer for the Site R241 preview.
 * This is neither a commercial order nor an integration event. Never import it
 * from siteOrderPersistence, route handlers, printers, status operations or stock.
 */
export const SITE_COMBO_UNIT_PREVIEW_SCHEMA = 1 as const;
export const SITE_COMBO_UNIT_PREVIEW_ENABLED = false as const;
export const SITE_COMBO_UNIT_PREVIEW_CAPABILITY = 'dfl_site_combo_unit_lines_v1' as const;
export const SITE_COMBO_UNIT_PREVIEW_CONTRACT = 'dfl_site_combo_units_preview_v1' as const;

const ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/;
const KEY = /^c([1-9][0-9]*):([1-9][0-9]*):([1-9][0-9]*)$/;
const CURRENCY_MAX = 150_000_000;
const obj = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const safeInt = (v: unknown, max = CURRENCY_MAX): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= max;
const cleanText = (v: unknown, max = 140): v is string =>
  typeof v === 'string' && v.length <= max && v.trim().length > 0 && !/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(v);
const safeNote = (v: unknown): v is string =>
  typeof v === 'string' && v.length <= 140 && !/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(v);
function check(ok: unknown, code: string): asserts ok {
  if (!ok) throw new Error(`SITE_COMBO_PREVIEW_${code}`);
}
function exactKeys(value: Record<string, unknown>, keys: readonly string[], code: string) {
  check(Object.keys(value).length === keys.length && keys.every(k => Object.prototype.hasOwnProperty.call(value,k)),code);
}
function stableHash(value: string): string {
  // Matches producer's diagnostic-only FNV checksum, NOT a signature or permission.
  let state = 2166136261;
  for (const char of value) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0;
  return `diagnostic-${state.toString(16).padStart(8,'0')}`;
}
export type SiteComboUnitPreviewLine = Readonly<{
  key:string;
  comboNumber:number;
  componentKey:string;
  productId:string;
  productLabel:string;
  unitNumber:number;
  groupQuantity:number;
  addons:readonly Readonly<{id:string;label:string;priceCents:number}>[];
  removals:readonly Readonly<{id:string;label:string}>[];
  note:string;
  extrasCents:number;
}>;
export type SiteComboPreviewReadModel = Readonly<{
  state:'preview_only';
  readable:true;
  canPersist:false;
  canPrint:false;
  canRelay:false;
  canCharge:false;
  capability:typeof SITE_COMBO_UNIT_PREVIEW_CAPABILITY;
  diagnosticId:string;
  productId:string;
  comboQuantity:number;
  basePerComboCents:number;
  extrasForOrderCents:number;
  totalPreviewCents:number;
  units:readonly SiteComboUnitPreviewLine[];
  kitchenPreviewLines:readonly string[];
}>;

/** Strictly parse the serialized Site R241 draft; never accept a future schema. */
export function inspectSiteComboUnitPreview(raw: unknown): SiteComboPreviewReadModel {
  check(obj(raw), 'ROOT_INVALID');
  exactKeys(raw,[ 'contract','version','status','authorization','producer','consumer','source',
    'accounting','units','safety','diagnosticId','eventId','orderId','sendAllowed' ],'ROOT_FIELDS_INVALID');
  check(raw.contract===SITE_COMBO_UNIT_PREVIEW_CONTRACT && raw.version===1 && raw.status==='preview_only', 'CONTRACT_INVALID');
  check(raw.sendAllowed===false && raw.eventId===null && raw.orderId===null,'NOT_OPERATIONAL');
  check(obj(raw.authorization),'AUTH_MISSING');
  exactKeys(raw.authorization,['order','checkout','payment','relay','print','production'],'AUTH_FIELDS_INVALID');
  check(Object.values(raw.authorization).every(v=>v===false),'AUTH_NOT_OFF');
  check(obj(raw.producer) && raw.producer.system==='dfl_site' && raw.producer.envelopeSchema===1 &&
    raw.producer.currentOrderSchema===2 && raw.producer.proposedUnitOrderSchema===3,'PRODUCER_INVALID');
  exactKeys(raw.producer,['system','envelopeSchema','currentOrderSchema','proposedUnitOrderSchema'],'PRODUCER_FIELDS_INVALID');
  check(obj(raw.consumer) && raw.consumer.system==='dfl_entregas' &&
    raw.consumer.requiredCapability===SITE_COMBO_UNIT_PREVIEW_CAPABILITY &&
    raw.consumer.observedSchema===1 && raw.consumer.supportsUnits===false,'CONSUMER_INVALID');
  exactKeys(raw.consumer,['system','requiredCapability','observedSchema','supportsUnits'],'CONSUMER_FIELDS_INVALID');
  check(obj(raw.source),'SOURCE_MISSING');
  exactKeys(raw.source,['productId','blueprintFingerprint','draftId','previewId','quantity'],'SOURCE_FIELDS_INVALID');
  check(typeof raw.source.productId==='string' && ID.test(raw.source.productId) &&
    typeof raw.source.blueprintFingerprint==='string' && /^v2-[a-f0-9]{8}$/.test(raw.source.blueprintFingerprint) &&
    typeof raw.source.draftId==='string' && /^draft-[a-f0-9]{8}-[a-f0-9]{8}$/.test(raw.source.draftId) &&
    Number.isInteger(raw.source.quantity) && Number(raw.source.quantity)>=1 && Number(raw.source.quantity)<=30 &&
    raw.source.previewId===`${raw.source.draftId}|q${raw.source.quantity}|${raw.source.blueprintFingerprint}`,'SOURCE_INVALID');
  check(obj(raw.accounting),'ACCOUNTING_MISSING');
  exactKeys(raw.accounting,['basePerComboCents','extrasPerComboCents','extrasForOrderCents','previewTotalCents','payable'],'ACCOUNTING_FIELDS_INVALID');
  check(raw.accounting.payable===false && safeInt(raw.accounting.basePerComboCents,5_000_000) &&
    safeInt(raw.accounting.extrasPerComboCents) && safeInt(raw.accounting.extrasForOrderCents) &&
    safeInt(raw.accounting.previewTotalCents),'ACCOUNTING_INVALID');
  check(obj(raw.safety),'SAFETY_MISSING');
  exactKeys(raw.safety,['losslessForLegacyReceiver','requiresEntregasUpgrade','unitChoices','addonUnits','removedIngredients','annotatedUnits'],'SAFETY_FIELDS_INVALID');
  check(raw.safety.losslessForLegacyReceiver===false && raw.safety.requiresEntregasUpgrade===true,'SAFETY_INVALID');
  check(Array.isArray(raw.units) && raw.units.length>0 && raw.units.length<=1800 &&
    raw.units.length % Number(raw.source.quantity)===0,'UNITS_INVALID');
  const units:SiteComboUnitPreviewLine[]=[];
  const keys=new Set<string>();
  let totalExtras=0,changedUnits=0,addonUnits=0,removedIngredients=0,annotatedUnits=0;
  const perCombo=raw.units.length/Number(raw.source.quantity);
  for(let i=0;i<raw.units.length;i++) {
    const u=raw.units[i];check(obj(u),'UNIT_NOT_OBJECT');
    exactKeys(u,['unitKey','comboNumber','componentKey','productId','productLabel','unitNumber','groupQuantity','addons','removals','note','extrasCents'],'UNIT_FIELDS_INVALID');
    check(typeof u.unitKey==='string' && !keys.has(u.unitKey) && KEY.test(u.unitKey),'UNIT_KEY_INVALID');
    keys.add(u.unitKey);
    const m=KEY.exec(u.unitKey)!;
    check(u.comboNumber===Number(m[1]) && u.comboNumber===Math.floor(i/perCombo)+1 &&
      u.componentKey===`${m[2]}:${m[3]}` && u.unitNumber===Number(m[3]) &&
      u.unitNumber>=1 && Number.isInteger(u.groupQuantity) && Number(u.groupQuantity)>=Number(u.unitNumber) &&
      u.unitKey===`c${u.comboNumber}:${u.componentKey}`,'UNIT_POSITION_INVALID');
    check(typeof u.productId==='string' && ID.test(u.productId) && cleanText(u.productLabel,100) && safeNote(u.note),'UNIT_TEXT_INVALID');
    check(Array.isArray(u.addons) && u.addons.length<=20 && Array.isArray(u.removals) && u.removals.length<=20,'UNIT_OPTIONS_INVALID');
    const addons:Array<{id:string;label:string;priceCents:number}>=[];
    const removals:Array<{id:string;label:string}>=[];
    const addonIds=new Set<string>(), removalIds=new Set<string>();
    let unitExtras=0;
    for(const a of u.addons){
      check(obj(a),'ADDON_NOT_OBJECT');exactKeys(a,['id','label','priceCents'],'ADDON_FIELDS_INVALID');
      check(typeof a.id==='string' && ID.test(a.id) && !addonIds.has(a.id) && cleanText(a.label,100) && safeInt(a.priceCents,1_000_000),'ADDON_INVALID');
      addonIds.add(a.id);unitExtras+=Number(a.priceCents);addons.push({id:a.id,label:a.label,priceCents:a.priceCents});
    }
    for(const a of u.removals){
      check(obj(a),'REMOVAL_NOT_OBJECT');exactKeys(a,['id','label'],'REMOVAL_FIELDS_INVALID');
      check(typeof a.id==='string' && ID.test(a.id) && !removalIds.has(a.id) && cleanText(a.label,100),'REMOVAL_INVALID');
      removalIds.add(a.id);removals.push({id:a.id,label:a.label});
    }
    check(safeInt(u.extrasCents) && u.extrasCents===unitExtras,'UNIT_PRICE_INVALID');
    totalExtras+=unitExtras;changedUnits+=Number(Boolean(addons.length||removals.length||u.note.length));
    addonUnits+=addons.length;removedIngredients+=removals.length;annotatedUnits+=Number(Boolean(u.note.length));
    const componentKey=u.componentKey;
    if(i>=perCombo){
      const template=units[i%perCombo];
      check(template.componentKey===componentKey && template.productId===u.productId &&
        template.productLabel===u.productLabel && JSON.stringify(template.addons)===JSON.stringify(addons) &&
        JSON.stringify(template.removals)===JSON.stringify(removals) && template.note===u.note,'COMBO_REPETITION_INVALID');
    }
    units.push({key:u.unitKey,comboNumber:u.comboNumber,componentKey,productId:u.productId,
      productLabel:u.productLabel,unitNumber:Number(u.unitNumber),groupQuantity:Number(u.groupQuantity),
      addons,removals,note:u.note,extrasCents:unitExtras});
  }
  check(Number.isSafeInteger(totalExtras) && totalExtras===raw.accounting.extrasForOrderCents &&
    totalExtras===Number(raw.accounting.extrasPerComboCents)*Number(raw.source.quantity) &&
    raw.accounting.previewTotalCents===Number(raw.accounting.basePerComboCents)*Number(raw.source.quantity)+totalExtras,'TOTAL_MISMATCH');
  check(safeInt(raw.safety.unitChoices,1800) && raw.safety.unitChoices===changedUnits &&
    raw.safety.addonUnits===addonUnits && raw.safety.removedIngredients===removedIngredients &&
    raw.safety.annotatedUnits===annotatedUnits,'COUNTERS_INVALID');
  check(typeof raw.diagnosticId==='string' && raw.diagnosticId===stableHash(JSON.stringify({
    source:raw.source,accounting:raw.accounting,units:raw.units,
  })),'DIAGNOSTIC_INVALID');
  // This checksum only detects accidental drift; NOT authenticity or permission.
  const validatedSource = raw.source as Record<string, unknown>;
  const validatedAccounting = raw.accounting as Record<string, unknown>;
  const lines=units.map(u=>{
    const details=[...u.addons.map(a=>`+ ${a.label}`),...u.removals.map(a=>`SEM ${a.label}`),...(u.note?[`OBS: ${u.note}`]:[])];
    return `SIMULAÇÃO · combo ${u.comboNumber}/${validatedSource.quantity} · ${u.productLabel} ${u.unitNumber}/${u.groupQuantity} [${u.key}] · ${details.join(' · ')||'PADRÃO'}`;
  });
  return {state:'preview_only',readable:true,canPersist:false,canPrint:false,canRelay:false,
    canCharge:false,capability:SITE_COMBO_UNIT_PREVIEW_CAPABILITY,diagnosticId:raw.diagnosticId,
    productId:String(validatedSource.productId),comboQuantity:Number(validatedSource.quantity),
    basePerComboCents:Number(validatedAccounting.basePerComboCents),extrasForOrderCents:totalExtras,
    totalPreviewCents:Number(validatedAccounting.previewTotalCents),units,kitchenPreviewLines:lines};
}
