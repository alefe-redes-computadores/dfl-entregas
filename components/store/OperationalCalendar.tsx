// components/store/OperationalCalendar.tsx
'use client';
import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { dateFromKey, dateKey } from '@/lib/operational-time';

export function OperationalCalendar({selected,onSelect,onClose,markedDates}:{selected:string;onSelect:(key:string)=>void;onClose:()=>void;markedDates:Set<string>}){
  const [month,setMonth]=useState(()=>dateFromKey(selected));
  const days=useMemo(()=>{const first=new Date(month.getFullYear(),month.getMonth(),1);const start=new Date(first.getFullYear(),first.getMonth(),1-first.getDay());return Array.from({length:42},(_,index)=>{const day=new Date(start);day.setDate(start.getDate()+index);return day;});},[month]);
  const today=dateKey(new Date());
  return <div className="fixed inset-0 z-[120] flex items-end bg-black/80 p-3 backdrop-blur-sm sm:items-center sm:justify-center" onClick={onClose}><div className="w-full max-w-sm rounded-[30px] border border-zinc-800 bg-zinc-950 p-5 shadow-2xl" onClick={event=>event.stopPropagation()}>
    <div className="mb-5 flex items-center justify-between"><Nav icon={ChevronLeft} onClick={()=>setMonth(value=>new Date(value.getFullYear(),value.getMonth()-1,1))}/><div className="text-center"><CalendarDays className="mx-auto mb-1 text-emerald-400" size={18}/><p className="font-heading text-base font-black capitalize">{month.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</p><button onClick={()=>onSelect(today)} className="text-[10px] font-bold uppercase text-emerald-400">Ir para hoje</button></div><Nav icon={ChevronRight} onClick={()=>setMonth(value=>new Date(value.getFullYear(),value.getMonth()+1,1))}/></div>
    <div className="grid grid-cols-7 text-center text-[10px] font-bold text-zinc-600">{['D','S','T','Q','Q','S','S'].map((label,index)=><span key={`${label}-${index}`} className="pb-2">{label}</span>)}</div>
    <div className="grid grid-cols-7 gap-1">{days.map(day=>{const key=dateKey(day),active=key===selected,current=day.getMonth()===month.getMonth();return <button key={key} onClick={()=>onSelect(key)} className={`relative flex aspect-square items-center justify-center rounded-xl text-xs font-bold ${active?'bg-emerald-500 text-zinc-950':key===today?'bg-emerald-500/10 text-emerald-400':current?'text-zinc-300':'text-zinc-700'}`}>{day.getDate()}{markedDates.has(key)&&<span className={`absolute bottom-1 h-1 w-1 rounded-full ${active?'bg-zinc-950':'bg-emerald-400'}`}/>}</button>;})}</div>
    <button onClick={onClose} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 text-xs font-bold text-zinc-400"><X size={15}/>Fechar calendário</button>
  </div></div>;
}
function Nav({icon:Icon,onClick}:{icon:typeof ChevronLeft;onClick:()=>void}){return <button onClick={onClick} className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-zinc-400"><Icon size={19}/></button>;}
