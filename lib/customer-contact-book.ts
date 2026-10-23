import type { Customer, CustomerPhone, CustomerAddress } from '@/types';
import { normalizeBrazilPhone } from '@/lib/phone';

const digits = (value?: string) => String(value || '').replace(/\D/g, '');
const addressKey = (value?: string, neighborhood?: string) =>
  [value, neighborhood].map(part => String(part || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ').trim()).join('|');

// Legacy fields are read as a virtual primary, not migrated via writes on mount.
export function customerPhones(customer: Pick<Customer, 'phone' | 'phones'>): CustomerPhone[] {
  const stored = (customer.phones || []).filter(item => !!digits(item.number));
  const source = stored.length ? stored : customer.phone ? [{id:'legacy-phone',number:customer.phone,primary:true,label:'Principal'}] : [];
  const seen = new Set<string>();
  return source.filter(item => { const key=normalizeBrazilPhone(item.number); if (!key || seen.has(key)) return false; seen.add(key); return true; })
    .map((item,index) => ({...item,primary:source.some(entry=>entry.primary) ? Boolean(item.primary) : index===0}));
}
export function customerAddresses(customer: Pick<Customer, 'address' | 'addresses' | 'neighborhood' | 'maps_link'>): CustomerAddress[] {
  const stored=(customer.addresses||[]).filter(item=>!!item.address.trim());
  const source=stored.length?stored:customer.address?[{id:'legacy-address',address:customer.address,neighborhood:customer.neighborhood,maps_link:customer.maps_link,primary:true,label:'Principal'}]:[];
  const seen=new Set<string>();
  return source.filter(item=>{const key=addressKey(item.address,item.neighborhood);if(!item.address.trim()||seen.has(key))return false;seen.add(key);return true;})
    .map((item,index)=>({...item,primary:source.some(entry=>entry.primary)?Boolean(item.primary):index===0}));
}
export function customerPhoneMatches(customer: Customer, query: string) {
  const sought=digits(query);return sought.length>=3&&customerPhones(customer).some(item=>digits(item.number).includes(sought) || `55${digits(item.number)}`.includes(sought));
}
export function customerSearchBlob(customer: Customer) {
  return [customer.name,customer.origin,customer.neighborhood,customer.phone,customer.address,...customerPhones(customer).flatMap(item=>[item.number,item.label]),...customerAddresses(customer).flatMap(item=>[item.address,item.neighborhood,item.label,item.reference])]
    .filter(Boolean).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
}
export function customerContactPayload(phonesInput: CustomerPhone[], addressesInput: CustomerAddress[]): Pick<Customer,'phone'|'phones'|'address'|'addresses'|'neighborhood'|'maps_link'> {
  const phoneRows=phonesInput.map((item,index)=>({...item,id:item.id||`phone-${index}`,number:normalizeBrazilPhone(item.number)})).filter(item=>item.number.length>=10);
  const uniquePhones=new Set<string>();
  const phones=phoneRows.filter(item=>{if(uniquePhones.has(item.number))return false;uniquePhones.add(item.number);return true;});
  const addressRows=addressesInput.map((item,index)=>({...item,id:item.id||`addr-${index}`,address:item.address.trim()})).filter(item=>!!item.address);
  const uniqueAddresses=new Set<string>();
  const addresses=addressRows.filter(item=>{const key=addressKey(item.address,item.neighborhood);if(uniqueAddresses.has(key))return false;uniqueAddresses.add(key);return true;});
  const phonePrimary=phones.find(item=>item.primary)||phones[0];
  const addressPrimary=addresses.find(item=>item.primary)||addresses[0];
  // Exactly one primary in each collection, keeping legacy consumers working.
  return {phones:phones.map(item=>({...item,primary:item.id===phonePrimary?.id})),addresses:addresses.map(item=>({...item,primary:item.id===addressPrimary?.id})),phone:phonePrimary?.number||'',address:addressPrimary?.address||'',neighborhood:addressPrimary?.neighborhood||'',maps_link:addressPrimary?.maps_link||''};
}
