/** R35: fronteira PURA. Não fornece autorização de login e nunca contém dados reais. */
import { STAGED_READ_PERMISSIONS } from './staffProjection';
export const REFRESH_SECTIONS=['home','routes','deliveries','stock','purchases'] as const;
export type RefreshSection=typeof REFRESH_SECTIONS[number];
export type RefreshItem={id:string;value:{title:string;subtitle:string;status:string}};
export type RefreshSnapshot=Record<RefreshSection,RefreshItem[]>;
export type RefreshAccount={uid?:unknown;status?:unknown;role?:unknown;permissions?:unknown;linkedMotoboyId?:unknown;draftId?:unknown;updatedAt?:unknown};
export type RefreshRejection='uid'|'suspended'|'role'|'permissions'|'motoboy_link'|'draft'|'version';
export const safeRefreshUid=(value:unknown):value is string=>typeof value==='string'&&/^[a-zA-Z0-9_-]{8,120}$/.test(value);
export function assessRefreshAccount(uid:string,account:RefreshAccount):RefreshRejection[]{
 const errors:RefreshRejection[]=[];
 if(!safeRefreshUid(uid)||account.uid!==uid)errors.push('uid');
 if(account.status!=='suspended')errors.push('suspended');
 if(!['motoboy','compras','operacao','personalizado'].includes(String(account.role)))errors.push('role');
 if(!Array.isArray(account.permissions)||account.permissions.some(p=>typeof p!=='string'||!(STAGED_READ_PERMISSIONS as readonly string[]).includes(p))||new Set(account.permissions).size!==account.permissions.length)errors.push('permissions');
 if((account.role==='motoboy'||(account.role==='personalizado'&&Array.isArray(account.permissions)&&account.permissions.some(p=>p==='routes_read'||p==='deliveries_read')))&&(typeof account.linkedMotoboyId!=='string'||!/^[a-zA-Z0-9_-]{1,120}$/.test(account.linkedMotoboyId)))errors.push('motoboy_link');
 if(!safeRefreshUid(account.draftId))errors.push('draft');
 if(typeof account.updatedAt!=='string'||!Number.isFinite(Date.parse(account.updatedAt)))errors.push('version');
 const perms=Array.isArray(account.permissions)?account.permissions:[];
 if((account.role==='motoboy'&&(perms.includes('stock_read')||perms.includes('purchases_read')))||
    (account.role==='compras'&&(perms.includes('routes_read')||perms.includes('deliveries_read'))))errors.push('permissions');
 return [...new Set(errors)];
}
export function allowedRefreshSections(account:RefreshAccount):RefreshSection[]{
 if(assessRefreshAccount(String(account.uid||''),account).length)return [];
 const access=new Set(account.permissions as string[]);
 return REFRESH_SECTIONS.filter(s=>access.has(s==='home'?'home':s==='routes'?'routes_read':s==='deliveries'?'deliveries_read':s==='stock'?'stock_read':'purchases_read'));
}
export const emptyRefreshSnapshot=():RefreshSnapshot=>({home:[],routes:[],deliveries:[],stock:[],purchases:[]});
export function sameProjectedValue(a:unknown,b:unknown){
 const normalize=(x:unknown)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x as Record<string,unknown>).sort(([k],[j])=>k.localeCompare(j))):x;
 return JSON.stringify(normalize(a))===JSON.stringify(normalize(b));
}
export function compareRefreshSnapshot(before:RefreshSnapshot,after:RefreshSnapshot){
 const areas=REFRESH_SECTIONS.map(area=>{
  const a=new Map(before[area].map(r=>[r.id,r.value]));
  const b=new Map(after[area].map(r=>[r.id,r.value]));
  let added=0,removed=0,changed=0;
  for(const [id,value] of b){if(!a.has(id))added++;else if(!sameProjectedValue(a.get(id),value))changed++;}
  for(const id of a.keys())if(!b.has(id))removed++;
  return {area,previous:a.size,next:b.size,added,removed,changed};
 });
 return {areas,totalNew:areas.reduce((sum,a)=>sum+a.next,0),totalChanges:areas.reduce((sum,a)=>sum+a.added+a.removed+a.changed,0)};
}
