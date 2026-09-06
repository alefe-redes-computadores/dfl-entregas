'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, User } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/useAppStore';

export default function EditRoutePage(){
 const router=useRouter(); const id=useSearchParams().get('id'); const route=useAppStore(s=>s.routes.find(r=>r.id===id)); const motoboys=useAppStore(s=>s.motoboys.filter(m=>m.active)); const updateRoute=useAppStore(s=>s.updateRoute);
 const [name,setName]=useState(''); const [motoboyId,setMotoboyId]=useState(''); const [change,setChange]=useState(''); const [saving,setSaving]=useState(false);
 useEffect(()=>{if(route){setName(route.name);setMotoboyId(route.motoboy_id || motoboys.find(m=>m.name===route.motoboy_name)?.id || '');setChange(String(route.change_money||''));}},[motoboys,route]);
 if(!route)return <div className="py-20 text-center text-zinc-400">Rota não encontrada.</div>;
 const save=async(e:React.FormEvent)=>{e.preventDefault();const motoboy=motoboys.find(m=>m.id===motoboyId);if(!name.trim()||!motoboy){toast.error('Informe o nome e o motoboy.');return;}setSaving(true);try{await updateRoute(route.id,{name:name.trim(),motoboy_id:motoboy.id,motoboy_name:motoboy.name,change_money:Number(change||0)});toast.success('Rota atualizada.');router.push(`/rotas/details?id=${route.id}`);}catch{toast.error('Não foi possível atualizar a rota.');}finally{setSaving(false);}};
 return <div className="flex flex-col gap-6"><div className="flex items-center gap-3"><button onClick={()=>router.back()} className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900"><ArrowLeft size={20}/></button><h1 className="font-heading text-xl font-bold">Editar rota</h1></div><form onSubmit={save} className="space-y-5"><label className="block text-sm font-bold text-zinc-400">Nome<input value={name} onChange={e=>setName(e.target.value)} className="mt-2 h-14 w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 text-zinc-100 outline-none focus:border-emerald-500"/></label><div><p className="mb-2 text-sm font-bold text-zinc-400">Motoboy</p><div className="grid grid-cols-2 gap-2">{motoboys.map(m=><button type="button" key={m.id} onClick={()=>setMotoboyId(m.id)} className={`flex h-12 items-center justify-center gap-2 rounded-xl border font-bold ${motoboyId===m.id?'border-emerald-500 bg-emerald-500/10 text-emerald-400':'border-zinc-800 bg-zinc-900 text-zinc-400'}`}><User size={15}/>{m.name}</button>)}</div></div><label className="block text-sm font-bold text-zinc-400">Troco inicial<input type="number" min="0" step="0.01" value={change} onChange={e=>setChange(e.target.value)} className="mt-2 h-14 w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 outline-none focus:border-emerald-500"/></label><button disabled={saving} className="h-14 w-full rounded-2xl bg-emerald-500 font-bold text-zinc-950 disabled:opacity-50">{saving?'Salvando...':'Salvar alterações'}</button></form></div>;
}
