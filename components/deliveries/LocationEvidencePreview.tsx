'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, MapPin, Navigation2, ExternalLink } from 'lucide-react';
import { MiniMap } from '@/components/deliveries/MiniMap';
import { locationEvidence } from '@/lib/location-evidence';

interface Props { address:string; mapsLink?:string|null; compact?:boolean; sourceLabel?:string; }
/** Loads Google Maps iframe only after an explicit tap, never for a list of route cards. */
export function LocationEvidencePreview({address,mapsLink,compact=false,sourceLabel}:Props){
 const [open,setOpen]=useState(false);
 const evidence=useMemo(()=>locationEvidence(address,mapsLink),[address,mapsLink]);
 useEffect(()=>setOpen(false),[address,mapsLink]);
 if(evidence.kind==='missing')return null;
 const strong=evidence.kind==='coordinate';
 return <section data-no-card-swipe="true" className={`min-w-0 rounded-xl border ${strong?'border-emerald-500/20 bg-emerald-500/[.04]':'border-sky-500/15 bg-sky-500/[.03]'} ${compact?'px-2 py-1':'p-3'}`} aria-label="Conferência de localização">
  <div className="flex min-w-0 items-center gap-2">
   <span className={`grid ${compact?'h-7 w-7':'h-8 w-8'} shrink-0 place-items-center rounded-lg ${strong?'bg-emerald-500/10 text-emerald-300':'bg-sky-500/10 text-sky-300'}`}>{strong?<Navigation2 size={15}/>:<MapPin size={15}/>}</span>
   <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-black text-zinc-200">{evidence.title}</p>{!compact&&<p className="mt-0.5 text-[10px] leading-relaxed text-zinc-500">{sourceLabel?`${sourceLabel} · `:''}{evidence.explanation}</p>}{compact&&<p className="truncate text-[9px] text-zinc-500">Toque para conferir o mapa</p>}</div>
   <button type="button" aria-expanded={open} aria-label={open?'Ocultar prévia do mapa':'Abrir prévia do mapa'} onClick={event=>{event.stopPropagation();setOpen(value=>!value)}} className={`flex ${compact?'min-h-8':'min-h-10'} shrink-0 items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 text-[10px] font-bold text-zinc-300`}>{open?'Ocultar':'Prévia'}<ChevronDown size={13} className={open?'rotate-180':''}/></button>
  </div>
  {open&&<div className="mt-2" onClick={event=>event.stopPropagation()}><MiniMap address={address} mapsLink={mapsLink||undefined}/><p className="mt-2 text-[10px] leading-relaxed text-zinc-500">{evidence.explanation}</p>{evidence.mapsUrl&&<a href={evidence.mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-sky-500/25 px-3 text-[11px] font-bold text-sky-300"><ExternalLink size={12}/>Conferir no Google Maps</a>}</div>}
 </section>;
}
