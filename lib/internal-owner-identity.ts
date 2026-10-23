import type { Customer, Motoboy } from '@/types';
import { normalizeBrazilPhone } from '@/lib/phone';

const normalize=(value?:string)=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g,' ').trim();
const digits=(value?:string)=>normalizeBrazilPhone(value);

// R76: owner identity requires affirmative mark OR converging name, phone AND
// address legacy evidence. No owner number/address is printed in diagnostics.
// The literal reference values below are filled by the anchored installer
// from the pre-existing owner modules rather than guessed by the client.
const OWNER_LEGACY_PHONE = '34999229439';
const OWNER_LEGACY_STREET = 'lazaro martins marciel 164';
const OWNER_LEGACY_NEIGHBORHOOD = 'jardim quebec';
const names=new Set(['alefe','alefe johsefe','alefe johsefe de brito gomes']);
const ownerName=(name?:string)=>names.has(normalize(name));
export function ownerNameAndPhone(name?:string,phone?:string) {
  return ownerName(name)&&digits(phone)===OWNER_LEGACY_PHONE;
}
export function verifiedInternalCustomer(customer?:Customer|null) {
  if(!customer)return false;
  if(customer.internal_owner_verified===true)return true;
  // Historical records: three independent evidence dimensions. No writes.
  const address=normalize(customer.address);
  return ownerNameAndPhone(customer.name,customer.phone)&&address.includes(OWNER_LEGACY_STREET)&&address.includes(OWNER_LEGACY_NEIGHBORHOOD);
}
export function verifiedInternalMotoboy(motoboy?:Motoboy|null) {
  // Motoboy has no phone field; name-only identification could hide homonyms.
  return motoboy?.internal_owner_verified===true;
}
