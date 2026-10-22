'use client';
import { Boxes, Bike, ClipboardList, LockKeyhole, PackageCheck, ShieldCheck, ShoppingBasket } from 'lucide-react';
import { planStaffAccess } from '@/lib/access/staffRoleMatrix';
import type { AccessPermission, StaffRole } from '@/lib/access/roles';
import { STAFF_SECTION_LABEL } from '@/lib/access/staffRuntime';
const icons={home:ShieldCheck,routes:Bike,deliveries:PackageCheck,stock:Boxes,purchases:ShoppingBasket};
export function StaffPermissionPreview({role,permissions,linkedMotoboyId}:{role:StaffRole;permissions:AccessPermission[];linkedMotoboyId?:string}) {
  const plan=planStaffAccess(role,permissions,linkedMotoboyId);
  return <section aria-label="Prévia de acesso do funcionário" className="rounded-[22px] border border-emerald-500/20 bg-emerald-500/[.035] p-3.5">
    <div className="flex items-start gap-2.5"><ShieldCheck size={19} className="mt-0.5 shrink-0 text-emerald-400"/><div><h3 className="text-sm font-black text-zinc-100">O que esta pessoa poderá consultar</h3><p className="mt-0.5 text-[11px] leading-relaxed text-zinc-400">Prévia das áreas após uma futura autorização. Salvar não libera login.</p></div></div>
    <div className="mt-3 flex flex-wrap gap-1.5">{plan.visible.map(area=>{const Icon=icons[area];return <span key={area} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-bold text-emerald-200"><Icon size={13}/>{STAFF_SECTION_LABEL[area]}</span>})}{!plan.visible.length&&<span className="text-xs text-amber-300">Nenhuma área liberável com a configuração atual.</span>}</div>
    <div className="mt-2 flex items-center gap-1.5 text-[10px] text-zinc-500"><LockKeyhole size={12}/> Bloqueadas: {plan.restricted.map(a=>STAFF_SECTION_LABEL[a]).join(' · ')||'Nenhuma área operacional'}</div>
    {plan.requests.length>0&&<p className="mt-3 flex items-center gap-1.5 text-[11px] text-amber-200"><ClipboardList size={14}/> Poderá pedir conferência: {plan.requests.includes('delivery_confirmation')?'entregas':''}{plan.requests.length===2?' e ':''}{plan.requests.includes('purchase_intent')?'compras':''}. Sem aplicação automática.</p>}
    <div className="mt-3 space-y-1 border-t border-emerald-500/10 pt-2">{plan.notes.map(note=><p key={note} className="text-[10px] leading-relaxed text-zinc-400">• {note}</p>)}</div>
  </section>;
}
