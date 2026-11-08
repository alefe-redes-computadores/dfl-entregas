'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  ArrowLeft, BellRing, BookOpenCheck, ChevronRight,
  ClipboardCheck, FileImage, History, LockKeyhole, MessageSquareText,
  Route as RouteIcon, ShieldCheck, SlidersHorizontal, Sparkles,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { isSuperadminUid } from '@/lib/access/roles';
// Carregamento sob demanda no APK/PWA: as duas centrais não competem por recursos.
const MensageriaDiagnosticPage = dynamic(()=>import('@/app/mais/mensageria/page'),{ssr:false,
  loading:()=> <p role="status" className="p-4 text-xs text-zinc-400">Preparando diagnósticos de mensagens...</p>});
const AcompanhamentoAdminPage = dynamic(()=>import('@/app/mais/acompanhamento/page'),{ssr:false,
  loading:()=> <p role="status" className="p-4 text-xs text-zinc-400">Preparando acompanhamento privado...</p>});

type Section = 'visao' | 'mensagens' | 'acompanhamento' | 'materiais';
const sections: Array<{id:Section; label:string; icon:typeof MessageSquareText}> = [
  {id:'visao',label:'Visão geral',icon:Sparkles},
  {id:'mensagens',label:'Mensagens',icon:MessageSquareText},
  {id:'acompanhamento',label:'Acompanhar',icon:ShieldCheck},
  {id:'materiais',label:'Materiais',icon:FileImage},
];

export default function Comunicacao360Page(){
  const router=useRouter();
  const owner=useAppStore(state=>state.user);
  const [section,setSection]=useState<Section>('visao');
  const allowed=isSuperadminUid(owner?.uid);
  if(!allowed) return <div className="dfl-page mx-auto max-w-3xl pb-28"><div role="alert" className="rounded-[22px] border border-amber-500/25 bg-amber-500/[.05] p-5"><LockKeyhole size={21} className="text-amber-400"/><h1 className="mt-3 font-heading text-lg font-black">Comunicação protegida</h1><p className="mt-2 text-xs leading-relaxed text-zinc-400">A central é exclusiva do proprietário. Nenhuma consulta ou emissão de acesso foi iniciada.</p><button type="button" onClick={()=>router.push('/mais')} className="mt-4 min-h-11 rounded-xl border border-zinc-700 px-4 text-xs font-bold">Voltar para Mais</button></div></div>;
  return <div className="dfl-page mx-auto max-w-3xl space-y-4 pb-[calc(env(safe-area-inset-bottom)+100px)]">
    <header className="flex items-start gap-3 px-1 pt-1">
      <button type="button" onClick={()=>router.push('/mais')} aria-label="Voltar para Mais" className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-300"><ArrowLeft size={18}/></button>
      <div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-[.16em] text-emerald-400">DFL 360 · Gestão</p><h1 className="font-heading text-2xl font-black text-zinc-50">Comunicação 360</h1><p className="mt-1 text-xs leading-relaxed text-zinc-400">Mensagens, acompanhamento e materiais operacionais em uma experiência, com permissões separadas.</p></div>
    </header>
    <nav aria-label="Áreas da Comunicação 360" className="grid grid-cols-4 gap-1.5 rounded-[19px] border border-zinc-800 bg-zinc-900/65 p-1.5">
      {sections.map(item=>{const Icon=item.icon;return <button key={item.id} type="button" aria-current={section===item.id?'page':undefined} aria-pressed={section===item.id} onClick={()=>setSection(item.id)} className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-[14px] px-1 py-2 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 ${section===item.id?'border border-emerald-500/30 bg-emerald-500/10 text-emerald-200':'border border-transparent text-zinc-400 active:bg-zinc-800'}`}><Icon size={17}/><span className="text-[10px] font-bold leading-tight">{item.label}</span></button>})}
    </nav>
    {section==='visao'&&<div className="space-y-3">
      <div className="rounded-[21px] border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[.08] to-zinc-900/35 p-4"><p className="text-[10px] font-black uppercase tracking-[.14em] text-emerald-300">Operação sem promessas falsas</p><h2 className="mt-1 text-base font-black text-zinc-100">Tudo no lugar certo</h2><p className="mt-2 text-xs leading-relaxed text-zinc-400">O status do WhatsApp deve ser consultado no servidor. Pedido na fila não comprova mensagem recebida pelo cliente. O acompanhamento protegido continua com emissão manual nesta versão.</p></div>
      <HubCard icon={MessageSquareText} title="Saúde das mensagens" caption="Consultar outbox, tentativas, falhas e homologação. Sem envio automático a partir deste painel." onClick={()=>setSection('mensagens')} />
      <HubCard icon={ShieldCheck} title="Acompanhamento protegido" caption="Inspecionar pedido, emitir ou revogar acesso privado, conforme autorização do servidor." onClick={()=>setSection('acompanhamento')} />
      <HubCard icon={FileImage} title="Mensagens e imagens" caption="Rotas, checklist de saída e comprovantes de acerto do motoboy." onClick={()=>setSection('materiais')} />
      <details className="rounded-[18px] border border-zinc-800 bg-zinc-900/30"><summary className="flex min-h-12 cursor-pointer items-center gap-2 px-3.5 text-xs font-black text-zinc-300"><SlidersHorizontal size={16} className="text-sky-300"/> Segurança e disponibilidade</summary><div className="space-y-2 border-t border-zinc-800 p-3.5 text-[11px] leading-relaxed text-zinc-400"><p><ShieldCheck size={14} className="mr-1 inline text-sky-300"/> O rastreio e a mensageria continuam com capacidades e autorizações independentes.</p><p><LockKeyhole size={14} className="mr-1 inline text-amber-300"/> Emissão automática de link permanece OFF até Gate conjunto Site R21, Entregas, provedor WhatsApp e worker.</p><p><History size={14} className="mr-1 inline"/> A troca de abas encerra o estado temporário da tela anterior. Não deixe link emitido sem compartilhamento seguro ou revogação.</p></div></details>
    </div>}
    {section==='mensagens'&&<section aria-label="Central de Mensagens" className="min-w-0"><MensageriaDiagnosticPage/></section>}
    {section==='acompanhamento'&&<section aria-label="Acompanhamento protegido" className="min-w-0"><AcompanhamentoAdminPage/></section>}
    {section==='materiais'&&<div className="space-y-3">
      <div className="rounded-[20px] border border-zinc-800 bg-zinc-900/45 p-4"><p className="flex items-center gap-2 text-sm font-black text-zinc-100"><BookOpenCheck size={18} className="text-sky-300"/> Materiais da operação</p><p className="mt-2 text-[11px] leading-relaxed text-zinc-400">Os textos e as imagens são preparados na rota ou no acerto correspondente, com os valores atuais daquele registro. Esta central não inventa ou guarda cópias de dados do pedido.</p></div>
      <HubCard icon={RouteIcon} title="Rotas e checklist de saída" caption="Na rota, escolha texto, imagem ou checklist compacto/guiado. Confira destinatário, códigos e bebidas." onClick={()=>router.push('/rotas')}/>
      <HubCard icon={FileImage} title="Comprovantes do motoboy" caption="Abra o motoboy e o acerto. Escolha imagem resumida ou detalhada, sem confundir pedidos e paradas." onClick={()=>router.push('/motoboys')}/>
      <HubCard icon={ClipboardCheck} title="Confirmações iFood" caption="Ficam na Loja e na saída da rota; não são uma terceira central de mensagens." onClick={()=>router.push('/loja/caixa-de-entrada?aba=site')}/>
      <div className="rounded-[18px] border border-amber-500/15 bg-amber-500/[.035] p-3 text-[11px] leading-relaxed text-zinc-400"><BellRing size={15} className="mr-1 inline text-amber-300"/> Abrir o seletor do Android não comprova envio ou leitura do WhatsApp. A confirmação depende do canal e da evidência disponível.</div>
    </div>}
  </div>;
}

function HubCard({icon:Icon,title,caption,onClick}:{icon:typeof MessageSquareText;title:string;caption:string;onClick:()=>void}){
  return <button type="button" onClick={onClick} className="flex min-h-[88px] w-full items-center gap-3 rounded-[20px] border border-zinc-800 bg-zinc-900/45 px-3.5 py-3 text-left transition-colors active:bg-zinc-800/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-emerald-500/15 bg-emerald-500/[.07] text-emerald-300"><Icon size={20}/></span><span className="min-w-0 flex-1"><strong className="block text-sm font-black text-zinc-100">{title}</strong><small className="mt-1 block text-[11px] leading-relaxed text-zinc-400">{caption}</small></span><ChevronRight size={16} className="shrink-0 text-zinc-500"/></button>;
}
