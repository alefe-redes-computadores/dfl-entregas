'use client';
import { useEffect, useId, useMemo, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { staffTouch } from '@/lib/access/staffTouch';

export type StaffChoice = {value:string;label:string;description?:string};
export function StaffChoicePicker({label,value,options,onChange,placeholder='Selecione uma opção',disabled=false}:{
  label:string;value:string;options:StaffChoice[];onChange:(value:string)=>void;placeholder?:string;disabled?:boolean;
}) {
  const id=useId();
  const [open,setOpen]=useState(false);
  const [filter,setFilter]=useState('');
  const selected=options.find(o=>o.value===value);
  const visible=useMemo(()=>options.filter(o=>`${o.label} ${o.description||''}`.toLocaleLowerCase('pt-BR').includes(filter.trim().toLocaleLowerCase('pt-BR'))),[options,filter]);
  useEffect(()=>{if(!open)return;const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false);setFilter('');}};document.addEventListener('keydown',onKey);return()=>document.removeEventListener('keydown',onKey)},[open]);
  return <div className="relative min-w-0 space-y-1.5">
    <span id={`${id}-label`} className="block text-xs font-bold text-zinc-300">{label}</span>
    <button type="button" aria-labelledby={`${id}-label ${id}-value`} aria-expanded={open} aria-controls={`${id}-choices`} disabled={disabled}
      onClick={()=>{staffTouch();setOpen(x=>!x);setFilter('')}}
      className={`flex min-h-12 w-full items-center gap-3 rounded-2xl border px-4 text-left text-sm transition disabled:opacity-40 ${open?'border-emerald-500/50 bg-zinc-950 text-zinc-100':'border-zinc-800 bg-zinc-900/80 text-zinc-200'}`}>
      <span id={`${id}-value`} className="min-w-0 flex-1 truncate">{selected?.label||placeholder}</span>
      <ChevronDown className={`shrink-0 text-zinc-400 transition-transform ${open?'rotate-180':''}`} size={17}/>
    </button>
    {open && <div id={`${id}-choices`} className="relative z-20 overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950 p-2 shadow-xl">
      {options.length>7&&<div className="relative mb-2"><Search className="absolute left-3 top-3 text-zinc-500" size={15}/><input autoFocus value={filter} onChange={e=>setFilter(e.target.value)} aria-label={`Buscar ${label.toLowerCase()}`} placeholder="Buscar nesta lista" className="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-900 pl-9 pr-9 text-xs text-zinc-100 outline-none focus:border-emerald-500/40"/><button type="button" onClick={()=>setFilter('')} aria-label="Limpar busca" className="absolute right-2 top-2 grid h-7 w-7 place-items-center text-zinc-400"><X size={15}/></button></div>}
      <div role="listbox" aria-labelledby={`${id}-label`} className="max-h-56 space-y-1 overflow-y-auto overscroll-contain">
        {visible.length===0&&<p className="px-3 py-4 text-center text-xs text-zinc-500">Nenhuma opção corresponde à busca.</p>}
        {visible.map(o=><button type="button" role="option" aria-selected={value===o.value} key={o.value}
          onClick={()=>{staffTouch();onChange(o.value);setOpen(false);setFilter('')}}
          className={`flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs ${value===o.value?'bg-emerald-500/10 text-emerald-300':'text-zinc-200 active:bg-zinc-900'}`}>
          <span className="min-w-0 flex-1"><span className="block font-bold">{o.label}</span>{o.description&&<span className="mt-0.5 block text-[10px] text-zinc-500">{o.description}</span>}</span>
          {value===o.value&&<Check size={16} className="shrink-0 text-emerald-400"/>}
        </button>)}
      </div>
      <button type="button" onClick={()=>{staffTouch();setOpen(false);setFilter('')}} className="mt-2 min-h-10 w-full rounded-xl border border-zinc-800 bg-zinc-900/60 text-xs font-bold text-zinc-300">Fechar lista</button>
    </div>}
  </div>;
}
