import type { Customer, CustomerAddress, CustomerPhone } from '@/types';
import { customerAddresses, customerPhones, customerContactPayload } from '@/lib/customer-contact-book';
import { normalizeCustomerName, normalizeCustomerPhone } from '@/lib/customer-identity';

export interface CustomerLinkSuggestion {
  customer: Customer;
  exactName: boolean;
  matchingPhone: boolean;
}

/**
 * Telefone validado e apenas pista: familiares podem compartilhar aparelho.
 * Nenhum vinculo automatico e autorizado por esta funcao.
 * Para anexar enderecos no cadastro existente, a escolha e SEMPRE humana
 * e exige nome completo igual (sufixos historicos (2) sao normalizados).
 */
export function customerPhoneLinkSuggestions(
  customers: Customer[],
  input: Pick<Customer, 'name'|'phone'|'phones'>,
): CustomerLinkSuggestion[] {
  const phones = new Set(customerPhones(input)
    .map(item=>normalizeCustomerPhone(item.number))
    .filter(phone=>phone.length>=10 && phone.length<=11));
  if (!phones.size) return [];
  const wantedName = normalizeCustomerName(input.name);
  return customers.flatMap(customer=>{
    const matchingPhone = customerPhones(customer).some(item=>
      phones.has(normalizeCustomerPhone(item.number)));
    if (!matchingPhone) return [];
    return [{customer, exactName:Boolean(wantedName) && normalizeCustomerName(customer.name)===wantedName, matchingPhone:true}];
  }).sort((a,b)=>Number(b.exactName)-Number(a.exactName) || a.customer.name.localeCompare(b.customer.name,'pt-BR'));
}

export function manualCustomerContactPatch(
  existing: Customer,
  draft: Pick<Customer, 'phone'|'phones'|'address'|'addresses'|'neighborhood'|'maps_link'>,
): Pick<Customer,'phone'|'phones'|'address'|'addresses'|'neighborhood'|'maps_link'> {
  const priorPhones: CustomerPhone[] = customerPhones(existing);
  const priorAddresses: CustomerAddress[] = customerAddresses(existing);
  // Mantem contato/destino principal do cadastro escolhido. Os novos entram
  // como alternativas; os pedidos antigos nao sao modificados.
  return customerContactPayload(
    [...priorPhones, ...customerPhones(draft).map(item=>({...item, primary:false}))],
    [...priorAddresses, ...customerAddresses(draft).map(item=>({...item, primary:false}))],
  );
}
