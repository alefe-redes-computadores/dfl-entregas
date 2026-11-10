import type { Customer } from '@/types';
import type { CustomerDuplicateCandidate } from '@/lib/customer-duplicates';

export interface CustomerDuplicateGroupMember {
  customer: Customer;
  orderCount: number;
}

export interface CustomerDuplicateGroup {
  key: string;
  name: string;
  members: CustomerDuplicateGroupMember[];
  candidates: CustomerDuplicateCandidate[];
  totalOrders: number;
}

/**
 * Apenas organiza as sugestoes CONSERVADORAS ja aprovadas pelo motor legado.
 * A conectividade e visual, nao uma prova transitiva de identidade: o usuario
 * so pode mesclar diretamente um par que possua sua propria evidencia.
 * Nenhuma escrita, nenhum descarte de endereco e nenhuma fusao em lote.
 */
export function customerDuplicateGroups(
  candidates: CustomerDuplicateCandidate[],
): CustomerDuplicateGroup[] {
  const members = new Map<string, CustomerDuplicateGroupMember>();
  const edges = new Map<string, Set<string>>();
  for (const candidate of candidates) {
    for (const [customer, count] of [
      [candidate.left, candidate.leftOrders],
      [candidate.right, candidate.rightOrders],
    ] as const) {
      if (!members.has(customer.id)) members.set(customer.id, {customer, orderCount: count});
      if (!edges.has(customer.id)) edges.set(customer.id, new Set());
    }
    edges.get(candidate.left.id)!.add(candidate.right.id);
    edges.get(candidate.right.id)!.add(candidate.left.id);
  }

  const visited = new Set<string>();
  const groups: CustomerDuplicateGroup[] = [];
  for (const id of [...members.keys()].sort()) {
    if (visited.has(id)) continue;
    const queue = [id];
    visited.add(id);
    const connected: string[] = [];
    while (queue.length) {
      const current = queue.shift()!;
      connected.push(current);
      for (const next of edges.get(current) || []) {
        if (visited.has(next)) continue;
        visited.add(next);
        queue.push(next);
      }
    }
    if (connected.length < 2) continue;
    const ids = new Set(connected);
    const rows = connected.map(key=>members.get(key)!)
      .sort((a,b)=>b.orderCount-a.orderCount || a.customer.name.localeCompare(b.customer.name,'pt-BR') || a.customer.id.localeCompare(b.customer.id));
    const related = candidates.filter(item=>ids.has(item.left.id)&&ids.has(item.right.id));
    groups.push({
      key: [...ids].sort().join('|'),
      name: rows[0].customer.name.replace(/\s*\(\d+\)\s*$/, ''),
      members: rows,
      candidates: related,
      totalOrders: rows.reduce((sum,row)=>sum+row.orderCount,0),
    });
  }
  return groups.sort((a,b)=>b.members.length-a.members.length || b.totalOrders-a.totalOrders || a.name.localeCompare(b.name,'pt-BR'));
}

/** Prova direta: nao permitir fusao apenas porque A-B e B-C. */
export function directDuplicateEvidence(
  group: CustomerDuplicateGroup,
  a: string,
  b: string,
): CustomerDuplicateCandidate | undefined {
  return group.candidates.find(item =>
    (item.left.id === a && item.right.id === b) ||
    (item.left.id === b && item.right.id === a));
}

export interface CustomerNameReviewGroup {
  key: string;
  name: string;
  members: Customer[];
  unverifiedCount: number;
}

/**
 * Visibilidade complementar para cadastros antigos SEM telefone suficiente.
 * Nunca fornece autorizacao de merge — apenas caminho para edicao humana.
 */
export function customerUnverifiedNameGroups(
  customers: Customer[],
  candidates: CustomerDuplicateCandidate[],
): CustomerNameReviewGroup[] {
  const verifiedIds = new Set(candidates.flatMap(pair=>[pair.left.id,pair.right.id]));
  const normalize = (s:string) => String(s||'').replace(/\s*\(\d+\)\s*$/,'')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
    .replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
  const names = new Map<string,Customer[]>();
  for(const customer of customers){
    const name=normalize(customer.name);
    if(!name)continue;
    const list=names.get(name)||[];
    list.push(customer);
    names.set(name,list);
  }
  return [...names].flatMap(([key,members]):CustomerNameReviewGroup[]=>{
    const unverifiedCount=members.filter(row=>!verifiedIds.has(row.id)).length;
    if(members.length<2||unverifiedCount===0)return [];
    return [{key,name:members[0].name.replace(/\s*\(\d+\)\s*$/,''),members,unverifiedCount}];
  }).sort((a,b)=>b.unverifiedCount-a.unverifiedCount || b.members.length-a.members.length || a.name.localeCompare(b.name,'pt-BR'));
}
