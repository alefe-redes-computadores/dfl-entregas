/** R234 · Busca 360: somente consulta/navegação, sem leitura remota nem escrita. */
import type { Customer, Delivery, Route, StockProduct } from '@/types';
import { matchesOperationSearch, normalizeOperationSearch } from '@/lib/operation/searchR99';

export type AssistantDestination = { id: string; title: string; subtitle: string; href: string };
export type AssistantMatch = { id: string; kind: 'delivery' | 'route' | 'stock'; title: string; detail: string; href: string };

function validDate(date: string) { return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : ''; }
function url(path: string, query: Record<string, string | undefined> = {}) {
  const parts = Object.entries(query).filter(([, value]) => Boolean(value));
  return path + (parts.length ? '?' + parts.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value!)}`).join('&') : '');
}
export function assistantSearchSubject(raw: string) {
  let subject = normalizeOperationSearch(raw).slice(0, 110);
  subject = subject.replace(/^(?:(?:quero|preciso|pode|me|os|as|um|uma)\s+)*(?:buscar|procurar|localizar|encontrar|mostrar|abrir|ver|pesquisar|listar|filtrar)\s+/, '');
  subject = subject.replace(/^(?:(?:os|as|o|a)\s+)?(?:pedidos?|entregas?|produtos?|itens?|rotas?)\s+(?:(?:do|da|de|dos|das|com|por)\s+)?/, '');
  return subject.trim();
}

export function assistantDestinations(raw: string, selectedDate = ''): AssistantDestination[] {
  const query = normalizeOperationSearch(raw).slice(0, 110);
  if (!query) return [];
  const date = validDate(selectedDate);
  const subject = assistantSearchSubject(raw);
  const results: AssistantDestination[] = [];
  const add = (id: string, title: string, subtitle: string, href: string) => results.push({ id, title, subtitle, href });
  if (/\b(caixa de entrada|pedidos? (?:do|recebidos? (?:no|pelo)) site|importar pedidos?|rascunhos?)\b/.test(query)) {
    add('inbox', 'Caixa de Entrada', 'Pedidos do Site e triagem manual', '/loja/caixa-de-entrada');
  } else if (/\b(compras?|fornecedores?)\b/.test(query)) {
    const item = subject.replace(/\b(?:compras?|fornecedores?|ontem|hoje|semana|mes|m[eê]s|no|na|de|do|da|dos|das|em|com|um|uma|o|a|itens?|produtos?)\b/g, ' ').replace(/\s+/g,' ').trim().slice(0,80);
    add('purchases', 'Montar compra', item ? `Pesquisar ${item} na lista` : 'Conferir sugestões e lista de mercado', url('/estoque/compras', {q:item||undefined}));
  } else if (/\b(estoque|produto|produtos|falta|abaixo do minimo|zerados?|acabando)\b/.test(query)) {
    const low = /abaixo|baixo|minimo|falta|acabando/.test(query);
    const zero = /zerado|zerou/.test(query);
    const q = /\b(?:buscar|procurar|encontrar|produto|estoque|no|na|de|do|da|com|ver|mostrar|listar)\b/g;
    const product = subject.replace(q, ' ').replace(/\s+/g, ' ').trim();
    add('stock', 'Estoque', low ? 'Filtrado abaixo do mínimo' : zero ? 'Filtrado: zerados' : 'Buscar produto localmente', url('/estoque', { q: !low && !zero ? product : undefined, filter: low ? 'baixo' : zero ? 'zero' : undefined }));
  } else if (/\b(rotas?|motoboy|motoboys|entregadores?)\b/.test(query)) {
    const filter = /montagem|montando|preparando/.test(query) ? 'montando' : /na rua|andamento|sairam/.test(query) ? 'na-rua' : undefined;
    const routeName = subject.replace(/\b(rotas?|motoboy|motoboys|entregadores?|em|montagem|montando|na|rua|do|da|de|por|com)\b/g, ' ').replace(/\s+/g, ' ').trim();
    add('routes', 'Rotas', filter === 'montando' ? 'Em montagem' : filter === 'na-rua' ? 'Na rua' : 'Listagem de rotas', url('/rotas', { date, filter, q: !filter ? routeName : undefined }));
  } else if (/\b(pagamentos?|recebimentos?|cobrar|a receber)\b/.test(query) && /pendente|conferir|receber|cobrar/.test(query)) {
    add('pending-payment', 'Pagamentos a conferir', 'Entrega e financeiro continuam separados', url('/entregas', { date, payment: 'pending' }));
  } else if (/\b(entregas?|pedidos?|clientes?|enderecos?|endere[cç]o|pendentes?)\b/.test(query)) {
    const pending = /pendentes?|nao finalizadas?|abertas?/.test(query);
    const incomplete = /endere[cç]o|revisar|incompletas?/.test(query);
    const status = incomplete ? 'incompletas' : pending ? 'pendentes' : undefined;
    const text = subject.replace(/\b(entregas?|pedidos?|clientes?|pendentes?|nao|finalizadas?|incompletas?|revisar|endere[cç]os?|do|da|de|com|em)\b/g, ' ').replace(/\s+/g, ' ').trim();
    add('deliveries', 'Entregas', incomplete ? 'Informações a revisar' : pending ? 'Pendentes' : 'Pesquisa por cliente, ID e endereço', url('/entregas', { date, status, q: !status ? text : undefined }));
  }
  return results;
}

export function searchAssistantSnapshot(input: string, data: {
  deliveries: readonly Delivery[];
  customers: readonly Customer[];
  routes: readonly Route[];
  products: readonly StockProduct[];
}, limit = 6): AssistantMatch[] {
  const query = assistantSearchSubject(input);
  if (query.length < 2) return [];
  const matches: AssistantMatch[] = [];
  const customerNames = new Map(data.customers.map(c => [c.id, c.name]));
  const push = (item: AssistantMatch) => { if (matches.length < limit) matches.push(item); };
  for (const product of data.products) {
    if (matches.length >= limit) break;
    if (!product.active) continue;
    if (matchesOperationSearch(`${product.name} ${product.category || ''} ${product.barcode || ''}`, query)) {
      push({ id: `stock:${product.id}`, kind: 'stock', title: product.name, detail: 'Produto do estoque', href: url('/estoque/detalhes', { id: product.id, from: 'estoque' }) });
    }
  }
  for (const delivery of data.deliveries) {
    if (matches.length >= limit) break;
    if (matchesOperationSearch([
      delivery.customer_name, customerNames.get(delivery.customer_id), delivery.address_string,
      delivery.order_id, delivery.ifood_id, delivery.external_order_id, delivery.id,
    ].filter(Boolean).join(' '), query)) {
      push({ id: `delivery:${delivery.id}`, kind: 'delivery', title: delivery.customer_name || customerNames.get(delivery.customer_id) || `Pedido ${delivery.order_id || delivery.id.slice(0, 8)}`, detail: `Pedido ${delivery.order_id || delivery.ifood_id || delivery.id.slice(0, 8)}`, href: url('/entregas/details', { id: delivery.id }) });
    }
  }
  for (const route of data.routes) {
    if (matches.length >= limit) break;
    if (matchesOperationSearch(`${route.name} ${route.motoboy_name} ${route.id}`, query)) {
      push({ id: `route:${route.id}`, kind: 'route', title: route.name, detail: `Rota · ${route.motoboy_name}`, href: url('/rotas/details', { id: route.id }) });
    }
  }
  return matches;
}
