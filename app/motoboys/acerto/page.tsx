'use client';
import { Suspense,useMemo,useState } from 'react';
import { useRouter,useSearchParams } from 'next/navigation';
import { ArrowDownLeft,ArrowUpRight,Banknote,CalendarDays,ChevronLeft,ChevronRight,Copy,Image as ImageIcon,Package,Plus,ReceiptText,Send,Trash2,X } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAppStore } from '@/store/useAppStore';
import { getMotoboyDayData,operationalDateKey } from '@/lib/motoboy-analytics';
import type { MotoboySettlementAdjustment } from '@/types';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const fromKey=(key:string)=>new Date(`${key}T12:00:00-03:00`);
const shift=(key:string,days:number)=>{const date=fromKey(key);date.setDate(date.getDate()+days);return operationalDateKey(date);};
const money=(value:number)=>value.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});

function Content(){
  const router=useRouter();
  const params=useSearchParams();
  const id=params.get('id');
  const motoboy=useAppStore(state=>state.motoboys.find(item=>item.id===id));
  const routes=useAppStore(state=>state.routes);
  const deliveries=useAppStore(state=>state.deliveries);
  const addOperationalExpense=useAppStore(state=>state.addOperationalExpense);
  const operationalExpenses=useAppStore(state=>state.operationalExpenses);

  const paramDate=params.get('date');
  const [date,setDate]=useState(()=>paramDate&&/^\d{4}-\d{2}-\d{2}$/.test(paramDate)?paramDate:operationalDateKey(new Date()));
  const [month,setMonth]=useState(()=>fromKey(date));
  const [calendar,setCalendar]=useState(false);
  const [adjustments,setAdjustments]=useState<MotoboySettlementAdjustment[]>([]);
  const [adjustmentKind,setAdjustmentKind]=useState<MotoboySettlementAdjustment['kind']>('meal');
  const [adjustmentDescription,setAdjustmentDescription]=useState('');
  const [adjustmentValue,setAdjustmentValue]=useState('');
  const [cashHandedOver,setCashHandedOver]=useState(true);
  const [saving,setSaving]=useState(false);
  const [imageBusy,setImageBusy]=useState(false);

  const sourceId=motoboy?`motoboy:${motoboy.id}:${date}`:'';
  const existing=operationalExpenses.find(item=>item.source_id===sourceId);
  const data=useMemo(()=>motoboy?getMotoboyDayData(motoboy,date,routes,deliveries,adjustments,cashHandedOver):null,[adjustments,cashHandedOver,date,deliveries,motoboy,routes]);
  const days=useMemo(()=>{const first=new Date(month.getFullYear(),month.getMonth(),1);const start=new Date(first.getFullYear(),first.getMonth(),1-first.getDay());return Array.from({length:42},(_,index)=>{const day=new Date(start);day.setDate(start.getDate()+index);return day;});},[month]);

  if(!motoboy||!data)return <div><PageHeader title="Acerto indisponível" to="/motoboys"/></div>;

  const addAdjustment=()=>{
    const amount=Number(adjustmentValue.replace(/\./g,'').replace(',','.'));
    if(!adjustmentDescription.trim()||!Number.isFinite(amount)||amount<=0)return void toast.error('Informe descrição e valor do ajuste.');
    setAdjustments(current=>[...current,{id:`adj-${Date.now()}`,kind:adjustmentKind,description:adjustmentDescription.trim(),amount}]);
    setAdjustmentDescription('');
    setAdjustmentValue('');
  };

  const summary=()=>{
    const [year,monthValue,day]=date.split('-');
    const lines=[
      `🧾 *ACERTO · DFL ENTREGAS*`,
      `🏍️ *Entregador:* ${motoboy.name}`,
      `📅 *Data:* ${day}/${monthValue}/${year}`,
      '',
      `📦 *${data.deliveries.length} entregas* · 🔁 *${data.completedRoutes} rotas*`,
      '',
      `💰 *DIÁRIA*`,
      data.fee.description,
      `*Acerto bruto: R$ ${money(data.fee.amount)}*`,
    ];
    if(adjustments.length){
      lines.push('','➖ *ABATIMENTOS*');
      adjustments.forEach(item=>lines.push(`• ${item.description}: R$ ${money(item.amount)}`));
      lines.push(`*Total de abatimentos: R$ ${money(data.totalVales)}*`);
    }
    lines.push(
      '',
      `💵 *Dinheiro das entregas:* R$ ${money(data.cashCollected)}`,
      cashHandedOver ? `↳ Caixa das entregas já conferido na loja` : `↳ Compensado no fechamento de caixa`,
      '',
      `🏪 *${data.mustReturn?'MOTOBOY DEVOLVE À LOJA':'LOJA PAGA AO MOTOBOY'}: R$ ${money(data.balance)}*`
    );
    return lines.join('\n');
  };

  const confirm=async()=>{
    if(existing)return void toast.info('Este dia já possui acerto registrado.');
    if(data.fee.amount<=0)return void toast.error('Não há valor de acerto para registrar.');
    if(!data.routes.length)return void toast.error('Não existem rotas deste motoboy nesta data.');

    const openRoutes=data.routes.filter(route=>route.status!=='fechada');
    const routeIds=new Set(data.routes.map(route=>route.id));
    const pending=deliveries.filter(delivery=>routeIds.has(delivery.route_id)&&!delivery.completed);
    if(openRoutes.length||pending.length)return void toast.error('Finalize a operação antes de confirmar o acerto.',{description:`${openRoutes.length} rota(s) aberta(s) · ${pending.length} entrega(s) pendente(s).`});

    const now=new Date().toISOString();
    setSaving(true);
    try{
      await addOperationalExpense({
        id:`expense-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
        occurred_at:`${date}T12:00:00-03:00`,
        type:'motoboy',
        description:`Acerto de motoboy · ${motoboy.name}`,
        // Custo operacional não diminui porque o motoboy está com dinheiro
        // recebido de clientes. A compensação pertence ao acerto de caixa.
        amount:data.fee.amount,
        motoboy_id:motoboy.id,
        motoboy_name:motoboy.name,
        source_kind:'motoboy_settlement',
        source_id:sourceId,
        settlement_gross_amount:data.fee.amount,
        settlement_net_payable:data.liquidFee,
        settlement_cash_balance:data.balance,
        settlement_adjustments:adjustments,
        settlement_delivery_count:data.deliveries.length,
        settlement_route_count:data.completedRoutes,
        settlement_cash_collected:data.cashCollected,
        settlement_cash_handed_over:cashHandedOver,
        observation:`${data.deliveries.length} entregas · ${data.completedRoutes} rotas · custo bruto R$ ${money(data.fee.amount)} · abatimentos R$ ${money(data.totalVales)} · líquido do motoboy R$ ${money(data.liquidFee)} · caixa R$ ${money(data.balance)}`,
        created_at:now,
        updated_at:now,
      });
      toast.success('Acerto confirmado e lançado em despesas.');
    }catch(error){toast.error(error instanceof Error?error.message:'Não foi possível confirmar o acerto.');}
    finally{setSaving(false);}
  };

  const copy=async()=>{await navigator.clipboard.writeText(summary());toast.success('Resumo copiado.');};
  const share=async()=>{if(navigator.share){try{await navigator.share({title:`Acerto · ${motoboy.name}`,text:summary()});return}catch{}}await copy();};
  const image=async()=>{
    if(imageBusy)return;
    setImageBusy(true);
    try{
    const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1350;
    const ctx=canvas.getContext('2d');if(!ctx)return void toast.error('Não foi possível gerar a imagem.');
    const round=(x:number,y:number,w:number,h:number,r:number,fill:string,stroke?:string)=>{ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}};
    const gradient=ctx.createLinearGradient(0,0,1080,1350);gradient.addColorStop(0,'#07130f');gradient.addColorStop(.48,'#09090b');gradient.addColorStop(1,'#111116');ctx.fillStyle=gradient;ctx.fillRect(0,0,1080,1350);
    ctx.fillStyle='#10b981';ctx.fillRect(0,0,1080,16);ctx.globalAlpha=.16;ctx.beginPath();ctx.arc(960,70,290,0,Math.PI*2);ctx.fillStyle='#10b981';ctx.fill();ctx.globalAlpha=1;
    round(64,64,952,190,38,'rgba(24,24,27,.88)','#27332f');round(88,88,76,76,22,'#10b981');ctx.fillStyle='#052e22';ctx.font='900 29px Arial';ctx.textAlign='center';ctx.fillText('DFL',126,137);ctx.textAlign='left';
    ctx.fillStyle='#f4f4f5';ctx.font='900 45px Arial';ctx.fillText('ACERTO DO MOTOBOY',190,125);ctx.fillStyle='#a1a1aa';ctx.font='600 28px Arial';ctx.fillText(motoboy.name,190,170);ctx.fillStyle='#6ee7b7';ctx.font='700 25px Arial';ctx.fillText(fromKey(date).toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}),190,210);
    round(64,286,952,156,34,'rgba(14,165,233,.07)','#173947');const stat=(x:number,label:string,value:string)=>{ctx.fillStyle='#71717a';ctx.font='700 22px Arial';ctx.fillText(label.toUpperCase(),x,337);ctx.fillStyle='#f4f4f5';ctx.font='900 38px Arial';ctx.fillText(value,x,392);};stat(100,'Entregas',String(data.deliveries.length));stat(405,'Rotas',String(data.completedRoutes));stat(700,'Dinheiro recebido',`R$ ${money(data.cashCollected)}`);
    round(64,474,952,492,34,'rgba(24,24,27,.9)','#27272a');ctx.fillStyle='#d4d4d8';ctx.font='900 25px Arial';ctx.fillText('RESUMO FINANCEIRO',100,526);
    let y=590;const row=(label:string,value:string,tone='#f4f4f5')=>{ctx.fillStyle='#8b8b94';ctx.font='600 27px Arial';ctx.fillText(label,100,y);ctx.fillStyle=tone;ctx.font='800 30px Arial';ctx.textAlign='right';ctx.fillText(value,980,y);ctx.textAlign='left';ctx.strokeStyle='#242429';ctx.beginPath();ctx.moveTo(100,y+25);ctx.lineTo(980,y+25);ctx.stroke();y+=72;};row('Acerto bruto',`R$ ${money(data.fee.amount)}`);row('Total de abatimentos',`- R$ ${money(data.totalVales)}`,'#fb7185');adjustments.slice(0,3).forEach(item=>row(`↳ ${item.description.slice(0,34)}`,`- R$ ${money(item.amount)}`,'#fb7185'));if(adjustments.length>3)row('Outros ajustes',`+ ${adjustments.length-3} item(ns)`);row('Líquido do motoboy',`R$ ${money(data.liquidFee)}`,'#34d399');
    const resultColor=data.mustReturn?'#f59e0b':'#10b981';round(64,998,952,218,38,resultColor);ctx.fillStyle='#052e22';ctx.font='900 24px Arial';ctx.fillText('RESULTADO DO ACERTO',104,1053);ctx.font='900 54px Arial';ctx.fillText(`R$ ${money(data.balance)}`,104,1123);ctx.font='900 27px Arial';ctx.fillText(data.mustReturn?'MOTOBOY DEVOLVE À LOJA':'LOJA PAGA AO MOTOBOY',104,1170);
    ctx.fillStyle='#71717a';ctx.font='600 21px Arial';ctx.fillText(cashHandedOver?'Caixa das entregas conferido na loja':'Dinheiro compensado no fechamento de caixa',72,1274);ctx.textAlign='right';ctx.fillText('Gerado pelo DFL Entregas',1008,1274);ctx.textAlign='left';
    const dataUrl=canvas.toDataURL('image/png',1);const filename=`acerto-${motoboy.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}-${date}.png`;
    if(Capacitor.isNativePlatform()){const saved=await Filesystem.writeFile({path:`dfl-acertos/${filename}`,data:dataUrl.split(',')[1],directory:Directory.Cache,recursive:true});await Share.share({title:`Acerto · ${motoboy.name}`,text:'Comprovante do acerto gerado pelo DFL Entregas.',files:[saved.uri],dialogTitle:'Compartilhar comprovante'});toast.success('Imagem gerada. Escolha onde compartilhar.');return;}
    const blob=await (await fetch(dataUrl)).blob();const file=new File([blob],filename,{type:'image/png'});if(navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({title:`Acerto · ${motoboy.name}`,files:[file]});return;}const link=document.createElement('a');link.download=filename;link.href=dataUrl;link.click();toast.success('Imagem baixada.');
    }catch(error){if(error instanceof Error&&/cancel/i.test(error.message))return;console.error('[ACERTO] Falha ao gerar imagem:',error);toast.error('Não foi possível gerar ou compartilhar a imagem.');}finally{setImageBusy(false);}
  };

  return <div className="flex flex-col gap-5 pb-28">
    <PageHeader title="Acerto do motoboy" subtitle={motoboy.name} to={`/motoboys/details?id=${motoboy.id}`}/>
    <div className="flex items-center gap-2 rounded-[22px] border border-zinc-800 bg-zinc-900/45 p-2"><button onClick={()=>setDate(value=>shift(value,-1))} className="date-button"><ChevronLeft/></button><button onClick={()=>{setMonth(fromKey(date));setCalendar(true)}} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-zinc-800 text-sm font-black"><CalendarDays size={17} className="text-emerald-400"/>{fromKey(date).toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'short'}).replaceAll('.','')}</button><button onClick={()=>setDate(value=>shift(value,1))} className="date-button"><ChevronRight/></button></div>

    {existing&&<section className="rounded-[22px] border border-emerald-500/20 bg-emerald-500/[.05] p-4"><p className="text-[9px] font-black uppercase tracking-[.15em] text-emerald-400">{typeof existing.settlement_gross_amount==='number'?'Acerto registrado':'Acerto registrado · legado'}</p><p className="mt-2 text-xl font-black text-emerald-300">R$ {money(existing.settlement_gross_amount ?? existing.amount)}</p><p className="mt-1 text-[10px] text-zinc-500">{typeof existing.settlement_gross_amount==='number'?'Custo operacional bruto do motoboy. O dinheiro recebido de clientes fica separado como liquidação de caixa.':'Valor originalmente registrado. Este acerto é anterior à separação entre custo bruto, abatimentos e caixa; o histórico não foi recalculado automaticamente.'}</p></section>}

    <div className="grid grid-cols-2 gap-3"><Card icon={Package} label="Entregas concluídas" value={String(data.deliveries.length)} tone="sky"/><Card icon={Banknote} label="Dinheiro líquido" value={`R$ ${money(data.cashCollected)}`} tone="amber"/></div>

    <section className="rounded-[24px] border border-sky-500/20 bg-sky-500/5 p-5"><p className="text-[10px] font-black uppercase tracking-wider text-sky-400">Prévia do acerto</p><div className="mt-4 space-y-3"><Line label="Acerto bruto" value={`R$ ${money(data.fee.amount)}`}/><p className="text-[10px] text-zinc-500">{data.fee.description}</p>{adjustments.map(item=><div key={item.id} className="flex items-center gap-2"><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-zinc-300">{item.description}</p><p className="text-[9px] text-zinc-600">{item.kind==='meal'?'Lanche':item.kind==='advance'?'Adiantamento':'Outro ajuste'}</p></div><span className="text-xs font-black text-red-400">- R$ {money(item.amount)}</span><button onClick={()=>setAdjustments(current=>current.filter(value=>value.id!==item.id))} className="grid h-8 w-8 place-items-center rounded-xl text-red-500"><Trash2 size={13}/></button></div>)}<div className="border-t border-sky-500/10 pt-3"><Line label="Ajustes" value={`- R$ ${money(data.totalVales)}`}/><Line label="Líquido a pagar" value={`R$ ${money(data.liquidFee)}`} strong/></div></div></section>

    <section><p className="mb-1 px-1 text-[10px] font-black uppercase tracking-wider text-zinc-500">Ajuste do acerto</p><p className="mb-2 px-1 text-[9px] text-zinc-700">Só use quando algo deve realmente ser abatido do pagamento.</p><div className="mb-2 grid grid-cols-3 gap-2">{([['meal','Lanche'],['advance','Adiantamento'],['other','Outro']] as const).map(([value,label])=><button key={value} onClick={()=>setAdjustmentKind(value)} className={`h-10 rounded-xl border text-[10px] font-black ${adjustmentKind===value?'border-amber-500/30 bg-amber-500/10 text-amber-300':'border-zinc-800 text-zinc-600'}`}>{label}</button>)}</div><div className="grid grid-cols-[1fr_100px_48px] gap-2"><input value={adjustmentDescription} onChange={e=>setAdjustmentDescription(e.target.value)} placeholder="Ex.: Lanche" className="input"/><input value={adjustmentValue} onChange={e=>setAdjustmentValue(e.target.value)} inputMode="decimal" placeholder="0,00" className="input"/><button onClick={addAdjustment} className="flex h-12 items-center justify-center rounded-xl bg-zinc-800"><Plus size={18}/></button></div></section>

    <label className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900/45 p-4"><div><p className="text-sm font-bold">Dinheiro já entregue ao caixa</p><p className="text-[10px] text-zinc-500">Desative se o dinheiro das entregas ainda estiver com o motoboy</p></div><input type="checkbox" checked={cashHandedOver} onChange={e=>setCashHandedOver(e.target.checked)} className="h-5 w-5 accent-emerald-500"/></label>

    <section className={`rounded-[26px] p-5 ${data.mustReturn?'bg-amber-500':'bg-emerald-500'}`}><div className="flex items-center justify-between text-zinc-950"><p className="text-[10px] font-black uppercase tracking-wider">Resultado do acerto</p>{data.mustReturn?<ArrowDownLeft/>:<ArrowUpRight/>}</div><p className="mt-1 text-3xl font-black text-zinc-950">R$ {money(data.balance)}</p><p className="mt-1 text-xs font-black text-zinc-900">{data.mustReturn?'MOTOBOY DEVOLVE À LOJA':'LOJA PAGA AO MOTOBOY'}</p></section>

    <button disabled={saving||Boolean(existing)} onClick={confirm} className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-sm font-black text-zinc-950 disabled:opacity-40"><ReceiptText size={17}/>{existing?'Acerto já registrado':saving?'Confirmando...':'Confirmar acerto'}</button>
    <div className="grid grid-cols-3 gap-2"><button onClick={copy} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-zinc-800 text-[10px] font-black text-zinc-300"><Copy size={14}/>Copiar</button><button onClick={share} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-zinc-800 text-[10px] font-black text-zinc-300"><Send size={14}/>Compartilhar</button><button disabled={imageBusy} onClick={()=>void image()} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-zinc-800 text-[10px] font-black text-zinc-300 disabled:opacity-40"><ImageIcon size={14}/>{imageBusy?'Gerando...':'Imagem'}</button></div>

    {calendar&&<div className="fixed inset-0 z-50 flex items-end bg-black/75 p-3 backdrop-blur-sm" onClick={()=>setCalendar(false)}><div className="w-full rounded-[30px] border border-zinc-800 bg-zinc-950 p-5" onClick={e=>e.stopPropagation()}><div className="mb-4 flex items-center justify-between"><button onClick={()=>setMonth(value=>new Date(value.getFullYear(),value.getMonth()-1,1))} className="date-button"><ChevronLeft/></button><p className="font-black capitalize">{month.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</p><button onClick={()=>setMonth(value=>new Date(value.getFullYear(),value.getMonth()+1,1))} className="date-button"><ChevronRight/></button></div><div className="grid grid-cols-7 text-center text-[10px] text-zinc-600">{['D','S','T','Q','Q','S','S'].map((label,index)=><span key={`${label}-${index}`}>{label}</span>)}</div><div className="mt-2 grid grid-cols-7 gap-1">{days.map(day=>{const key=operationalDateKey(day);return <button key={key} onClick={()=>{setDate(key);setCalendar(false)}} className={`aspect-square rounded-xl text-xs font-bold ${key===date?'bg-emerald-500 text-zinc-950':day.getMonth()===month.getMonth()?'text-zinc-300':'text-zinc-700'}`}>{day.getDate()}</button>})}</div><button onClick={()=>setCalendar(false)} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 text-xs font-bold text-zinc-400"><X size={15}/>Fechar</button></div></div>}

    <style jsx>{`.date-button{display:flex;height:2.75rem;width:2.75rem;align-items:center;justify-content:center;border-radius:1rem;color:rgb(113 113 122)}.input{height:3rem;min-width:0;border-radius:.75rem;border:1px solid rgb(39 39 42);background:rgb(24 24 27/.6);padding:0 .75rem;font-size:.75rem;outline:none}`}</style>
  </div>
}

function Line({label,value,strong=false}:{label:string;value:string;strong?:boolean}){return <div className="flex items-center justify-between gap-3"><span className={`text-xs ${strong?'font-black text-zinc-200':'text-zinc-500'}`}>{label}</span><span className={`${strong?'text-lg text-emerald-300':'text-sm text-zinc-300'} font-black`}>{value}</span></div>}
function Card({icon:Icon,label,value,tone}:{icon:typeof Package;label:string;value:string;tone:'sky'|'amber'}){return <div className={`rounded-[22px] border p-4 ${tone==='sky'?'border-sky-500/20 bg-sky-500/5':'border-amber-500/20 bg-amber-500/5'}`}><Icon size={16} className={tone==='sky'?'text-sky-400':'text-amber-400'}/><p className="mt-3 text-xl font-black">{value}</p><p className="text-[10px] text-zinc-500">{label}</p></div>}
export default function MotoboySettlementPage(){return <Suspense fallback={<p className="py-20 text-center text-zinc-500">Carregando...</p>}><Content/></Suspense>}
