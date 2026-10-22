'use client';
import { useState } from 'react';
import { Fingerprint, Send, ShieldCheck } from 'lucide-react';
import { requestOwnStaffLink } from '@/lib/access/staffClaimClient';
import { toast } from '@/lib/operational-toast';
/** Only on isolated staff HTTPS origin. Never grants access. */
export function StaffLinkRequest() {
  const [busy,setBusy]=useState(false);
  const [received,setReceived]=useState(false);
  const send=async()=>{
    if(busy||received)return;
    setBusy(true);
    try { const message=await requestOwnStaffLink();setReceived(true);toast.success(message); }
    catch(error){toast.error(error instanceof Error?error.message:'Não foi possível solicitar vínculo.');}
    finally{setBusy(false);}
  };
  return <section className="mt-5 w-full max-w-sm space-y-3 rounded-3xl border border-emerald-500/20 bg-emerald-500/[.045] p-4 text-left">
    <div className="flex items-start gap-3"><Fingerprint size={20} className="mt-0.5 shrink-0 text-emerald-400"/><div className="min-w-0"><h2 className="text-sm font-black text-zinc-100">Solicitar vínculo com a equipe</h2><p className="mt-1 text-xs leading-relaxed text-zinc-400">Se o administrador já cadastrou seu e-mail Google, envie o pedido. Ele conferirá a identidade antes de preparar o acesso.</p></div></div>
    <button type="button" disabled={busy||received} onClick={()=>void send()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-3 text-sm font-black text-zinc-950 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"><Send size={16}/>{received?'Pedido enviado':busy?'Enviando...':'Solicitar vínculo'}</button>
    <p className="flex items-start gap-2 text-[11px] leading-relaxed text-zinc-500"><ShieldCheck size={14} className="mt-0.5 shrink-0"/>O pedido não libera dados, rotas nem permissões automaticamente.</p>
  </section>;
}
