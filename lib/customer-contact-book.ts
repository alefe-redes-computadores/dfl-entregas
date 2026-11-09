import type { Customer, CustomerPhone, CustomerAddress } from '@/types';
import { normalizeBrazilPhone } from '@/lib/phone';


const digits = (value?: string) => String(value || '').replace(/\D/g, '');
/**
 * Rua+numero é identidade primária; bairro serve como discriminador quando
 * ambos cadastros o possuem. CEP, "bairro" duplicado e mapa diferente NÃO
 * criam três opções iguais na seleção.
 */
const canonicalAddress = (value?: string, neighborhood?: string) => {
  const raw = String(value || '').replace(/\b(?:CEP\s*:?\s*)?\d{5}\s*(?:-|–|—|\s)?\s*\d{3}\b/gi, ' ')
    .replace(/\s+/g, ' ').replace(/[\s,;–—-]+$/g, '').trim();
  const pieces = raw.split(/\s+[-–—]\s+/).map(x=>x.trim()).filter(Boolean);
  const district = String(neighborhood || '').trim() || pieces.slice(1).find(x=>!/^(?:patos de minas|mg|minas gerais)$/i.test(x)) || '';
  const plain = (s:string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  return {address: district && !plain(raw).includes(plain(district)) ? `${raw} - ${district}` : raw,
    neighborhood: district || undefined};
};
const addressParts = (item: CustomerAddress) => {
  const canonical = canonicalAddress(item.address, item.neighborhood);
  const street = canonical.address.split(/\s[-–—]\s/)[0]?.trim() || canonical.address;
  const key = String(street).normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/^(?:r\.?|rua|av\.?|avenida)\s+/i,'')
    .replace(/[^a-z0-9]+/g,' ').replace(/\b(?:cep|mg|patos de minas)\b/g,' ').replace(/\s+/g,' ').trim();
  const district = String(item.neighborhood || canonical.neighborhood || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return { key, district, canonical };
};
const equivalentAddress = (a:CustomerAddress,b:CustomerAddress):boolean => {
  const left=addressParts(a),right=addressParts(b);
  return Boolean(left.key && left.key===right.key &&
    (!left.district || !right.district || left.district===right.district));
};
const mergeAddressEntries = (source: CustomerAddress[]): CustomerAddress[] => {
  const unique: CustomerAddress[]=[];
  for(const item of source){
    if(!item.address?.trim())continue;
    const found=unique.findIndex(existing=>equivalentAddress(existing,item));
    if(found<0){unique.push({...item});continue;}
    const existing=unique[found];
    const preferred=item.primary && !existing.primary ? item : existing;
    const alternative=preferred===item ? existing : item;
    const preferredCanonical=canonicalAddress(preferred.address,preferred.neighborhood);
    const otherCanonical=canonicalAddress(alternative.address,alternative.neighborhood);
    const neighborhood=preferredCanonical.neighborhood||otherCanonical.neighborhood||preferred.neighborhood||alternative.neighborhood;
    unique[found]={...preferred,
      address:canonicalAddress(preferred.address,neighborhood).address,
      neighborhood,
      maps_link:preferred.maps_link||alternative.maps_link,
      primary:Boolean(existing.primary||item.primary),
      label:preferred.label||alternative.label,
    };
  }
  const primary=unique.find(item=>item.primary)||unique[0];
  return unique.map(item=>({...item,primary:item.id===primary?.id}));
};

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
  // Não grava nem exclui cadastros na montagem da tela; consolidação de leitura.
  return mergeAddressEntries(source);
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
  const addresses=mergeAddressEntries(addressRows).filter(item=>{
    const parts=addressParts(item);
    const key=`${parts.key}|${parts.district}`;
    if(uniqueAddresses.has(key))return false;
    uniqueAddresses.add(key);return true;
  });
  const phonePrimary=phones.find(item=>item.primary)||phones[0];
  const addressPrimary=addresses.find(item=>item.primary)||addresses[0];
  // Campos legados refletem SOMENTE o endereco principal, mas os demais ficam
  // preservados na colecao e continuam pesquisaveis. Nenhuma migracao implicita.
  // Exactly one primary in each collection, keeping legacy consumers working.
  return {phones:phones.map(item=>({...item,primary:item.id===phonePrimary?.id})),addresses:addresses.map(item=>({...item,primary:item.id===addressPrimary?.id})),phone:phonePrimary?.number||'',address:addressPrimary?.address||'',neighborhood:addressPrimary?.neighborhood||'',maps_link:addressPrimary?.maps_link||''};
}
