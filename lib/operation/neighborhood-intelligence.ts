/** R299 P11 — identidade territorial para ANALISE, nunca corrige cadastro automaticamente.
 * Catálogo conservador; município de Patos de Minas. Etapas numeradas nunca são colapsadas.
 */
export type NeighborhoodResolution = {
  input: string;
  display: string;
  canonical: string | null;
  confidence: 'verified_alias' | 'exact' | 'suggestion' | 'unknown';
  candidates: string[];
  reviewRequired: boolean;
};

const dictionary: ReadonlyArray<{ name:string; aliases:string[] }> = [
  { name:'Jardim Quebec', aliases:['jardim quebec','jd quebec','jardim kbek','jd kbek','quebec','kbek','jardim kebec','kebec','jardim quebeque'] },
  { name:'Jardim Esperança', aliases:['jardim esperanca','jd esperanca','jardim esperança','jd esperança'] },
  { name:'Nossa Senhora de Fátima', aliases:['nossa senhora de fatima','n senhora de fatima','n sra de fatima','n s de fatima','nossa sra de fatima','n s fatima','nossa senhora fatima'] },
  { name:'Ipanema', aliases:['ipanema'] },
];

const fold = (raw: string): string => String(raw || '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[.,;:]+/g,' ')
  .replace(/\s+/g,' ').trim();
const numericStage = (s:string) => /(?:^|\s)(?:[1-9]\d*|i{2,3}|iv|v|vi)(?:$|\s)/i.test(s);
const cleaned = (s:string) => s.trim().replace(/\s+/g,' ');
const canonicalMap = new Map<string,string>();
for (const entry of dictionary) for (const alias of entry.aliases) canonicalMap.set(fold(alias),entry.name);
const knownLabels = dictionary.map(entry => entry.name);

function editDistance(a: string,b: string): number {
  if (Math.abs(a.length-b.length)>4) return 5;
  let prev = Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){
    const curr=[i];
    for(let j=1;j<=b.length;j++) curr[j]=Math.min(curr[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
    prev=curr;
  }
  return prev[b.length];
}

function candidatesFor(value:string):string[] {
  const normalized=fold(value);
  if (!normalized || numericStage(normalized)) return [];
  const hit=knownLabels.map(name => {
    const key=fold(name);
    const source=normalized.replace(/^jd\.?\s+/,'jardim ').replace(/^n\s+sra?\s+/,'nossa senhora ');
    return {name,distance:editDistance(source,key)};
  }).filter(x=>x.distance <= Math.max(2,Math.floor(normalized.length*0.24)))
    .sort((a,b)=>a.distance-b.distance);
  return hit.slice(0,3).map(x=>x.name);
}

export function resolveNeighborhood(input: string | null | undefined): NeighborhoodResolution {
  const original=cleaned(String(input||''));
  const normalized=fold(original);
  if(!normalized) return {input:original,display:'Sem bairro',canonical:null,confidence:'unknown',candidates:[],reviewRequired:true};
  // Etapas/loteamentos numerados podem ser territorios diferentes; preservar sem excecao.
  if(numericStage(normalized)) return {input:original,display:original,canonical:null,confidence:'unknown',candidates:[],reviewRequired:true};
  const mapped=canonicalMap.get(normalized);
  if(mapped) return {input:original,display:mapped,canonical:mapped,confidence:normalized===fold(mapped)?'exact':'verified_alias',candidates:[],reviewRequired:false};
  // 'Fátima' isolado não é inequívoco: não transformar em N. Sra. de Fátima.
  const suggestion=normalized==='fatima'?['Nossa Senhora de Fátima']:candidatesFor(original);
  return {input:original,display:original,canonical:null,confidence:suggestion.length?'suggestion':'unknown',candidates:suggestion,reviewRequired:true};
}

/** Usado SOMENTE em agregacoes, preservando nomes desconhecidos e etapas numeradas. */
export function neighborhoodForReport(input: string | null | undefined): string | null {
  const result=resolveNeighborhood(input);
  return result.input ? result.display : null;
}

export type NeighborhoodAuditGroup = {
  label: string;
  variants: string[];
  customers: number;
  customerIds: string[];
  kind: 'aliases'|'review';
  suggestedCanonical: string | null;
};

export function auditNeighborhoods(customers: readonly {id:string; neighborhood?:string}[]): NeighborhoodAuditGroup[] {
  const canonical = new Map<string,{labels:Set<string>;ids:string[]}>();
  const review = new Map<string,{labels:Set<string>;ids:string[];candidate:string|null}>();
  for (const customer of customers) {
    const resolution=resolveNeighborhood(customer.neighborhood);
    if(!resolution.input) continue;
    if(resolution.canonical){
      const record=canonical.get(resolution.canonical)||{labels:new Set<string>(),ids:[]};
      record.labels.add(resolution.input);record.ids.push(customer.id);canonical.set(resolution.canonical,record);
    } else if(resolution.candidates.length){
      const key=resolution.candidates[0];
      const record=review.get(key)||{labels:new Set<string>(),ids:[],candidate:key};
      record.labels.add(resolution.input);record.ids.push(customer.id);review.set(key,record);
    }
  }
  const groups:NeighborhoodAuditGroup[]=[];
  for(const [name,item] of canonical){
    if(item.labels.size <=1 && [...item.labels][0]===name)continue;
    groups.push({label:name,variants:[...item.labels].sort(),customers:item.ids.length,customerIds:item.ids,kind:'aliases',suggestedCanonical:name});
  }
  for(const [name,item] of review){
    groups.push({label:`Revisar → ${name}`,variants:[...item.labels].sort(),customers:item.ids.length,customerIds:item.ids,kind:'review',suggestedCanonical:name});
  }
  return groups.sort((a,b)=>b.customers-a.customers||a.label.localeCompare(b.label,'pt-BR'));
}
