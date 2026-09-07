// components/store/StoreTimePicker.tsx
'use client';
import { Check, Clock3, X } from 'lucide-react';

interface StoreTimePickerProps {
  field:'start'|'end'; hour:string; minute:string;
  onChange:(value:{hour:string;minute:string})=>void; onConfirm:()=>void; onClose:()=>void;
}

export function StoreTimePicker({field,hour,minute,onChange,onConfirm,onClose}:StoreTimePickerProps){
  const hours=Array.from({length:24},(_,index)=>String(index).padStart(2,'0'));
  const minutes=['00','05','10','15','20','25','30','35','40','45','50','55'];
  return <div className="fixed inset-0 z-[130] flex items-end bg-black/85 p-3 backdrop-blur-sm sm:items-center sm:justify-center" onClick={onClose}><div className="w-full max-w-md rounded-[30px] border border-zinc-800 bg-zinc-950 p-5 shadow-2xl" onClick={event=>event.stopPropagation()}>
    <div className="flex items-center justify-between"><div><p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.18em] text-indigo-400"><Clock3 size={14}/>Expediente</p><h3 className="mt-1 font-heading text-xl font-black">Horário de {field==='start'?'início':'término'}</h3></div><button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-zinc-400"><X size={18}/></button></div>
    <div className="my-5 rounded-2xl border border-indigo-500/20 bg-indigo-500/[.07] py-4 text-center font-heading text-4xl font-black tracking-wider text-indigo-300">{hour}:{minute}</div>
    <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-zinc-500">Hora</p><div className="grid grid-cols-8 gap-1.5">{hours.map(value=><button key={value} onClick={()=>onChange({hour:value,minute})} className={`h-9 rounded-lg text-xs font-bold ${hour===value?'bg-indigo-500 text-white':'bg-zinc-900 text-zinc-400'}`}>{value}</button>)}</div>
    <p className="mb-2 mt-5 text-[10px] font-black uppercase tracking-wider text-zinc-500">Minutos</p><div className="grid grid-cols-6 gap-1.5">{minutes.map(value=><button key={value} onClick={()=>onChange({hour,minute:value})} className={`h-10 rounded-xl text-xs font-bold ${minute===value?'bg-indigo-500 text-white':'bg-zinc-900 text-zinc-400'}`}>{value}</button>)}</div>
    <button onClick={onConfirm} className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-zinc-100 font-black text-zinc-950 active:scale-[.98]"><Check size={18}/>Usar {hour}:{minute}</button>
  </div></div>;
}
