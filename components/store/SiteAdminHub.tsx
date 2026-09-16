'use client';
import { ExternalLink, Globe2, PackageCheck, ShieldCheck, ShoppingBag } from 'lucide-react';
import { useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
const SITE_ADMIN_URL='https://dafamilialanches.com.br/admin';
export function SiteAdminHub(){
 const deliveries=useAppStore(s=>s.deliveries);
 const stats=useMemo(()=>{
  const site=deliveries.filter(d=>d.source_system==='dfl_site');
  return {
    total: site.length,
    routed: site.filter(d=>Boolean(d.route_id)).length,
    awaiting: site.filter(d=>!d.route_id).length,
  };
},[deliveries]);
 return <section className="overflow-hidden rounded-[24px] border border-amber-400/20 bg-gradient-to-br from-amber-500/[.08] via-zinc-950 to-zinc-950"><div className="p-4"><div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-400 text-zinc-950"><ShoppingBag size={20}/></span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h2 className="text-sm font-black text-zinc-100">Administração do Site</h2><span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black text-emerald-300">DFL SITE</span></div><p className="mt-1 text-[11px] leading-relaxed text-zinc-500">Pedidos, cozinha, expedição, cardápio, operação, cupons, fidelidade e gestão comercial.</p></div></div><div className="mt-4 grid grid-cols-3 gap-2"><Metric icon={<PackageCheck size={15}/>} value={stats.routed} label="Ativos"/><Metric icon={<Globe2 size={15}/>} value={stats.awaiting} label="Sem rota"/><Metric icon={<ShieldCheck size={15}/>} value={stats.total} label="Recebidos"/></div><a href={SITE_ADMIN_URL} target="_blank" rel="noreferrer" className="mt-4 flex w-full items-center justify-between rounded-2xl bg-amber-400 px-4 py-3.5 text-zinc-950 active:scale-[.99]"><span><strong className="block text-sm font-black">Abrir administração completa</strong><small className="block text-[10px] font-bold text-zinc-800/70">Admin oficial do Site · autoridade comercial</small></span><ExternalLink size={18}/></a><p className="mt-3 text-[10px] leading-relaxed text-zinc-600">Site e Entregas usam projetos Firebase distintos; a sessão administrativa continua validada pelo próprio Site.</p></div></section>
}
function Metric({icon,value,label}:{icon:React.ReactNode;value:number;label:string}){return <div className="rounded-2xl border border-zinc-800/80 bg-black/20 p-3"><span className="text-amber-400">{icon}</span><strong className="mt-2 block text-lg font-black text-zinc-100">{value}</strong><span className="text-[9px] font-bold uppercase tracking-wide text-zinc-600">{label}</span></div>}
