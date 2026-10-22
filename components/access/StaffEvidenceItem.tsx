'use client';
import {Check, Circle, ShieldAlert} from 'lucide-react';
import {staffTouch} from '@/lib/access/staffTouch';
/** R34: lista temporaria de passos manuais. Um toque NAO equivale a validacao pelo servidor. */
export function StaffEvidenceItem({label,detail,checked,onChange}:{label:string;detail:string;checked:boolean;onChange:(next:boolean)=>void}){
  return <button type="button" role="checkbox" aria-checked={checked} onClick={()=>{staffTouch();onChange(!checked);}}
    className={`flex min-h-16 w-full items-start gap-3 rounded-[17px] border p-3.5 text-left active:scale-[.997] ${checked?'border-emerald-500/20 bg-emerald-500/[.035]':'border-zinc-800 bg-zinc-900/50'}`}>
    <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl ${checked?'bg-emerald-500/10 text-emerald-300':'bg-zinc-800 text-zinc-400'}`}>
      {checked?<Check size={17}/>:<Circle size={17}/>}</span>
    <span className="min-w-0 flex-1"><span className="block text-xs font-black text-zinc-100">{label}</span><span className="mt-1 block text-[11px] leading-relaxed text-zinc-400">{detail}</span></span>
    {checked&&<ShieldAlert size={14} className="mt-1 shrink-0 text-amber-300" aria-label="Conferência apenas declarada"/>}
  </button>;
}
