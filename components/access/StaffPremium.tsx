'use client';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowLeft, ChevronRight, LoaderCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import { staffTouch } from '@/lib/access/staffTouch';

type Tone = 'green' | 'amber' | 'rose' | 'sky' | 'neutral';
const surfaces: Record<Tone,string> = {
  green:'border-emerald-500/20 bg-emerald-500/[.055]',
  amber:'border-amber-500/20 bg-amber-500/[.055]',
  rose:'border-rose-500/20 bg-rose-500/[.045]',
  sky:'border-sky-500/20 bg-sky-500/[.05]',
  neutral:'border-zinc-800 bg-zinc-900/45',
};
const foreground: Record<Tone,string> = { green:'text-emerald-300', amber:'text-amber-300', rose:'text-rose-300', sky:'text-sky-300', neutral:'text-zinc-300' };
export function StaffPageHeader({ eyebrow,title,onBack,onRefresh,loading=false,icon:Icon=ShieldCheck }:{
  eyebrow:string;title:string;onBack:()=>void;onRefresh?:()=>void;loading?:boolean;icon?:LucideIcon;
}){
  return <header className="flex items-center gap-3">
    <button type="button" aria-label="Voltar para Equipe e permissões" onClick={() => {staffTouch();onBack();}}
      className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-zinc-800 bg-zinc-900/75 text-zinc-300 active:scale-[.97]"><ArrowLeft size={19}/></button>
    <div className="min-w-0 flex-1"><p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-emerald-400"><Icon size={13}/>{eyebrow}</p>
      <h1 className="mt-1 font-heading text-xl font-black tracking-tight text-zinc-50">{title}</h1></div>
    {onRefresh && <button type="button" aria-label="Atualizar informações" onClick={() => {staffTouch();onRefresh();}} disabled={loading}
      className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-zinc-800 bg-zinc-900/75 text-emerald-300 disabled:opacity-40 active:scale-[.97]">
      {loading?<LoaderCircle size={18} className="animate-spin"/>:<RefreshCw size={18}/>}</button>}
  </header>;
}
export function StaffPanel({ title,subtitle,icon:Icon=ShieldCheck,tone='neutral',children }:{
  title:string;subtitle?:string;icon?:LucideIcon;tone?:Tone;children?:ReactNode;
}){return <section className={`rounded-[23px] border p-3.5 sm:p-4 ${surfaces[tone]}`}>
  <div className="flex items-start gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[15px] border border-current/10 bg-zinc-950/45 ${foreground[tone]}`}><Icon size={19}/></span>
    <div className="min-w-0 flex-1"><h2 className="text-sm font-black text-zinc-100">{title}</h2>{subtitle&&<p className="mt-1 text-xs leading-relaxed text-zinc-400">{subtitle}</p>}</div></div>
  {children}
</section>}
export function StaffMetric({label,value,tone='neutral',icon:Icon=ShieldCheck}:{label:string;value:string|number;tone?:Tone;icon?:LucideIcon;}){
  return <div className={`min-w-0 rounded-[19px] border p-2.5 sm:p-3 ${surfaces[tone]}`}>
    <Icon size={15} className={foreground[tone]}/><p className="mt-2 font-heading text-[22px] font-black tabular-nums leading-none text-zinc-50">{value}</p>
    <p className="mt-2 text-[10px] leading-snug text-zinc-400">{label}</p>
  </div>;
}
export function StaffEmpty({title,subtitle,icon:Icon=ShieldCheck}:{title:string;subtitle:string;icon?:LucideIcon;}){
  return <div className="rounded-[23px] border border-dashed border-zinc-700 bg-zinc-900/30 px-4 py-6 text-center">
    <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-300"><Icon size={22}/></span>
    <p className="mt-3 text-sm font-black text-zinc-100">{title}</p><p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-zinc-400">{subtitle}</p>
  </div>;
}
export function StaffNavRow({label,detail,tone='neutral',icon:Icon=ChevronRight,onClick}:{label:string;detail?:string;tone?:Tone;icon?:LucideIcon;onClick:()=>void;}){
  return <button type="button" onClick={()=>{staffTouch();onClick();}} className={`flex min-h-14 w-full items-center gap-3 rounded-[18px] border px-3.5 py-3 text-left transition-colors active:scale-[.995] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500/60 ${surfaces[tone]}`}>
    <span className={`${foreground[tone]}`}><Icon size={19}/></span><span className="min-w-0 flex-1"><span className="block text-xs font-black text-zinc-100">{label}</span>
      {detail&&<span className="mt-1 block text-[11px] leading-relaxed text-zinc-400">{detail}</span>}</span><ChevronRight size={16} className="shrink-0 text-zinc-500"/></button>;
}
