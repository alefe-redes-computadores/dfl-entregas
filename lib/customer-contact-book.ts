import type { Customer, CustomerPhone, CustomerAddress } from '@/types';
import { normalizeBrazilPhone } from '@/lib/phone';


const digits = (value?: string) => String(value || '').replace(/\D/g, '');
/**
 * Rua+numero é identidade primária; bairro serve como discriminador quando
 * ambos cadastros o possuem. CEP, "bairro" duplicado e mapa diferente NÃO
 * criam três opções iguais na seleção.
 */

const normalizeAddressPart = (value?: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const stripAddressCep = (value?: string) =>
  String(value || '')
    .replace(/\b(?:CEP\s*:?\s*)?\d{5}\s*(?:-|–|—|\s)?\s*\d{3}\b/gi, ' ')
    .replace(/\bCEP\b/gi, ' ')
    .replace(/[·•]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[\s,;–—-]+$/g, '')
    .trim();

const canonicalAddress = (value?: string, neighborhood?: string) => {
  const raw=stripAddressCep(value);
  const district=stripAddressCep(neighborhood);
  const parts=raw.split(/\s+[-–—]\s+/).map(x=>x.trim()).filter(Boolean);
  const knownDistrict=district || (parts.length>1 ? parts[1] : '');
  const normalized=normalizeAddressPart(raw);
  const normalizedDistrict=normalizeAddressPart(knownDistrict);

  return {
    address:knownDistrict && !normalized.includes(normalizedDistrict)
      ? `${raw} - ${knownDistrict}`
      : raw,
    neighborhood:knownDistrict || undefined
  };
};

const addressParts = (item: CustomerAddress) => {
  const raw=stripAddressCep(item.address);
  const segments=raw.split(/\s+[-–—]\s+/).map(x=>x.trim()).filter(Boolean);

  const street=segments[0] || raw;
  const explicitDistrict=normalizeAddressPart(stripAddressCep(item.neighborhood));

  const suffixes=segments.slice(1).map(normalizeAddressPart).filter(Boolean);

  const district=explicitDistrict || (
    suffixes.length && !/^(?:apto|apartamento|casa|bloco|fundos|lote|sala|andar|loja|quadra|q|lt)\b/.test(suffixes[0])
      ? suffixes[0]
      : ''
  );

  const meaningfulSuffixes=suffixes.filter(part=>part!==district);

  // Se o bairro estiver embutido no texto principal,
  // retira-se apenas esse bairro da chave da rua.
  let streetKey=normalizeAddressPart(street);
  if(district && streetKey.endsWith(` ${district}`)){
    streetKey=streetKey.slice(0,-district.length-1);
  }

  // Complementos escritos junto ao número continuam na chave.
  const complement=meaningfulSuffixes.join(' ');
  const canonical=canonicalAddress(item.address,item.neighborhood);

  return {
    key:streetKey,
    district,
    complement,
    canonical
  };
};

const equivalentAddress = (
  a:CustomerAddress,
  b:CustomerAddress
):boolean => {
  const left=addressParts(a);
  const right=addressParts(b);

  if(!left.key || left.key!==right.key) return false;
  if(left.complement!==right.complement) return false;

  // Bairros conhecidos e diferentes nunca se fundem.
  if(left.district && right.district &&
     left.district!==right.district) return false;

  return true;
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
      address:([preferred,alternative].find(entry =>
        /(?:CEP\s*:?\s*)?\d{5}\s*(?:-|–|—|\s)?\s*\d{3}/i.test(entry.address)
      ) || preferred).address.trim(),
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
    const key=`${parts.key}|${parts.district}|${parts.complement}`;
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
