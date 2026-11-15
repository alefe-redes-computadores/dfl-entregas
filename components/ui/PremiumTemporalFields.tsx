'use client';

import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Clock3 } from 'lucide-react';
import {
  brClockToHHMM, brDateTimeToLocal, brDateToIso, isoDateToBr,
  maskBrClock, maskBrDate, splitLocalDateTime,
} from '@/lib/operation/premium-temporal';

const shell = 'flex min-h-12 min-w-0 items-center gap-2 rounded-xl border border-zinc-700/80 bg-zinc-950/80 px-3 text-zinc-100 focus-within:border-amber-400/60 focus-within:ring-1 focus-within:ring-amber-400/20';
const input = 'min-w-0 w-full bg-transparent text-sm font-semibold tabular-nums text-zinc-100 placeholder:text-zinc-600 outline-none disabled:opacity-40';

type Props = { value:string; onChange:(value:string)=>void; disabled?:boolean; required?:boolean; label:string };

/** Date data stays YYYY-MM-DD; only the visible editor uses DD/MM/YYYY. */
export function PremiumDateField({value,onChange,disabled,required,label}:Props) {
  const [draft,setDraft]=useState(()=>isoDateToBr(value));
  const lastSent=useRef(value);
  useEffect(()=>{if(value!==lastSent.current){lastSent.current=value;setDraft(isoDateToBr(value));}},[value]);
  const valid=brDateToIso(draft);
  const change=(raw:string)=>{
    const next=maskBrDate(raw);setDraft(next);
    const iso=brDateToIso(next)||'';
    lastSent.current=iso;onChange(iso);
  };
  return <label className="block min-w-0 space-y-1.5">
    <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400">{label}</span>
    <span className={shell}><CalendarDays size={17} className="shrink-0 text-amber-300" aria-hidden="true"/>
      <input aria-label={label} inputMode="numeric" autoComplete="off" placeholder="dd/mm/aaaa" maxLength={10}
        value={draft} onChange={e=>change(e.target.value)} disabled={disabled} required={required}
        aria-invalid={draft.length===10&&!valid} className={input}/>
    </span>
    {draft.length===10&&!valid && <small role="alert" className="block text-[10px] text-rose-300">Data inválida. Confira dia, mês e ano.</small>}
  </label>;
}

/** Datetime stores exactly the existing local YYYY-MM-DDTHH:mm form value. */
export function PremiumDateTimeField({value,onChange,disabled,required,label}:Props) {
  const initial=splitLocalDateTime(value);
  const [date,setDate]=useState(initial.date),[time,setTime]=useState(initial.time);
  const lastSent=useRef(value);
  useEffect(()=>{if(value!==lastSent.current){lastSent.current=value;const next=splitLocalDateTime(value);setDate(next.date);setTime(next.time);}},[value]);
  const commit=(d:string,t:string)=>{const next=brDateTimeToLocal(d,t)||'';lastSent.current=next;onChange(next);};
  const changeDate=(raw:string)=>{const d=maskBrDate(raw);setDate(d);commit(d,time);};
  const changeTime=(raw:string)=>{const t=maskBrClock(raw);setTime(t);commit(date,t);};
  const invalid=(date.length===10||time.length===5)&&!brDateTimeToLocal(date,time);
  return <fieldset className="min-w-0 space-y-1.5" disabled={disabled}>
    <legend className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">{label}</legend>
    <div className="grid min-w-0 grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-2">
      <label className={shell}><CalendarDays size={16} className="shrink-0 text-amber-300" aria-hidden="true"/>
        <input aria-label={`${label} · data`} value={date} onChange={e=>changeDate(e.target.value)} inputMode="numeric"
          autoComplete="off" placeholder="dd/mm/aaaa" maxLength={10} required={required} className={input}/></label>
      <label className={shell}><Clock3 size={16} className="shrink-0 text-sky-300" aria-hidden="true"/>
        <input aria-label={`${label} · hora`} value={time} onChange={e=>changeTime(e.target.value)} inputMode="numeric"
          autoComplete="off" placeholder="hh:mm" maxLength={5} required={required} className={input}/></label>
    </div>
    {invalid && <small role="alert" className="block text-[10px] text-rose-300">Confira a data e o horário (24 horas).</small>}
  </fieldset>;
}

/** Time preferences are only persisted on a complete valid HH:mm, never on partial typing. */
export function PremiumTimeField({value,onChange,disabled,required,label}:Props) {
  const [draft,setDraft]=useState(value);
  useEffect(()=>setDraft(value),[value]);
  const change=(raw:string)=>{
    const next=maskBrClock(raw);setDraft(next);
    const valid=brClockToHHMM(next);
    if(valid && valid!==value) onChange(valid);
  };
  return <span className={shell}><Clock3 size={16} className="shrink-0 text-emerald-300" aria-hidden="true"/>
    <input aria-label={label} inputMode="numeric" autoComplete="off" placeholder="hh:mm" maxLength={5}
      value={draft} onChange={e=>change(e.target.value)} onBlur={()=>{if(!brClockToHHMM(draft))setDraft(value);}}
      disabled={disabled} required={required} className={input}/>
  </span>;
}
