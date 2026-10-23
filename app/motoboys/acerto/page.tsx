'use client';
import { Suspense,useEffect,useMemo,useRef,useState } from 'react';
import { useRouter,useSearchParams } from 'next/navigation';
import { ArrowDownLeft,ArrowUpRight,Banknote,CalendarDays,ChevronLeft,ChevronRight,Copy,Image as ImageIcon,Package,Plus,ReceiptText,Send,Trash2,X,ShieldCheck } from 'lucide-react';
import { toast } from '@/lib/operational-toast';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAppStore } from '@/store/useAppStore';
import { getMotoboyDayData,operationalDateKey } from '@/lib/motoboy-analytics';
import { moneyValueToDraft,normalizeMoneyDraft,parseMoneyDraft } from '@/lib/route-cash-flow';
import type { MotoboySettlementAdjustment } from '@/types';
import { pendingAdjustmentsForSettlement, settlementAdjustmentSnapshot, settlementSourceId } from '@/lib/motoboy-settlement-authority';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { paintDflBrand, paintFittedText } from '@/lib/share-card-brand';
import { activeRouteDeliveries } from '@/lib/route-closure-eligibility';

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
  const closeMotoboySettlement=useAppStore(state=>state.closeMotoboySettlement);
  const addMotoboyAdjustment=useAppStore(state=>state.addMotoboyAdjustment);
  const cancelMotoboyAdjustment=useAppStore(state=>state.cancelMotoboyAdjustment);
  const motoboyAdjustments=useAppStore(state=>state.motoboyAdjustments);
  const user=useAppStore(state=>state.user);
  const operationalExpenses=useAppStore(state=>state.operationalExpenses);

  const selectedDate=useAppStore(state=>state.selectedDate);
  const paramDate=params.get('date');
  const [date,setDate]=useState(()=>paramDate&&/^\d{4}-\d{2}-\d{2}$/.test(paramDate)?paramDate:operationalDateKey(selectedDate));
  const [month,setMonth]=useState(()=>fromKey(date));
  const [calendar,setCalendar]=useState(false);
  const migratedDrafts=useRef(new Set<string>());
  const draftKey=id?`dfl:settlement-draft:v86:${id}:${date}`:'';
  const sharedAdjustments=useMemo(()=>motoboy?pendingAdjustmentsForSettlement(motoboyAdjustments,motoboy.id,date):[],[date,motoboy,motoboyAdjustments]);
  const adjustments=useMemo(()=>settlementAdjustmentSnapshot(sharedAdjustments),[sharedAdjustments]);
  useEffect(()=>{
    if(!draftKey||!motoboy||migratedDrafts.current.has(draftKey))return;
    migratedDrafts.current.add(draftKey);
    const migrate=async()=>{
      const raw=window.localStorage.getItem(draftKey);if(!raw)return;
      const parsed:unknown=JSON.parse(raw);if(!Array.isArray(parsed))return;
      const valid=parsed.filter((item):item is MotoboySettlementAdjustment=>Boolean(item&&typeof item==='object'&&typeof item.id==='string'&&typeof item.description==='string'&&typeof item.amount==='number'&&Number.isFinite(item.amount)&&item.amount>0));
      for(const item of valid){
        if(motoboyAdjustments.some(current=>current.id===item.id))continue;
        const now=new Date().toISOString();
        await addMotoboyAdjustment({...item,motoboy_id:motoboy.id,motoboy_name:motoboy.name,operational_date:date,status:'pending',author_uid:user?.uid,author_name:user?.displayName||user?.email||undefined,created_at:now,updated_at:now});
      }
      window.localStorage.removeItem(draftKey);
      if(valid.length)toast.success('Rascunho antigo sincronizado.',{description:`${valid.length} ajuste(s) agora estão disponíveis em todos os aparelhos.`});
    };
    void migrate().catch(()=>{migratedDrafts.current.delete(draftKey);toast.error('Rascunho local preservado.',{description:'A sincronização será tentada novamente depois.'});});
  },[addMotoboyAdjustment,date,draftKey,motoboy,motoboyAdjustments,user]);

  const [adjustmentDirection,setAdjustmentDirection]=useState<'deduction'|'addition'>('deduction');
  const [adjustmentDescription,setAdjustmentDescription]=useState('');
  const [adjustmentValue,setAdjustmentValue]=useState('');
  const [showAdjustmentForm,setShowAdjustmentForm]=useState(false);
  const [pendingRemoval,setPendingRemoval]=useState<MotoboySettlementAdjustment | null>(null);
  const [removalBusy,setRemovalBusy]=useState(false);
  const [settlementStrategy,setSettlementStrategy]=useState<'separate'|'offset'|'manual'>('separate');
  const [cashMode,setCashMode]=useState<'all'|'none'|'partial'>('all');
  const [cashHandedDraft,setCashHandedDraft]=useState('');
  const [saving,setSaving]=useState(false);
  const settlementInFlight=useRef(false);
  const copyInFlight=useRef(false);
  const [copyBusy,setCopyBusy]=useState(false);
  const [imageBusy,setImageBusy]=useState(false);
  const adjustmentSubmitting=useRef(false);
  const [adjustmentBusy,setAdjustmentBusy]=useState(false);

  const manualCashInput=cashMode==='all'?true:cashMode==='none'?false:parseMoneyDraft(cashHandedDraft);

  const sourceId=motoboy?settlementSourceId(motoboy.id,date):'';
  const existing=operationalExpenses.find(item=>item.source_id===sourceId);
  const priorSettlement=useMemo(()=>motoboy?operationalExpenses
    .filter(item=>item.motoboy_id===motoboy.id&&item.source_kind==='motoboy_settlement'&&operationalDateKey(item.occurred_at)<date)
    .sort((a,b)=>b.occurred_at.localeCompare(a.occurred_at))[0]:undefined,[date,motoboy,operationalExpenses]);
  // Somente o último acerto pode carregar saldo, e apenas quando ele foi
  // explicitamente deixado aberto. Registros antigos sem a flag são quitados.
  const priorCarry=useMemo(()=>priorSettlement?.settlement_carry_forward===true?({
    storeCredit:Math.max(0,Number(priorSettlement.settlement_store_credit)||0),
    motoboyCredit:Math.max(0,Number(priorSettlement.settlement_motoboy_credit)||0),
  }):({storeCredit:0,motoboyCredit:0}),[priorSettlement]);
  const baseData=useMemo(()=>motoboy?getMotoboyDayData(motoboy,date,routes,deliveries,existing?.settlement_adjustments||adjustments,true,priorCarry):null,[adjustments,date,deliveries,existing,motoboy,priorCarry,routes]);
  const offsetReturn=baseData?Math.max(0,baseData.cashInHand-Math.min(baseData.cashCollected,Math.max(0,baseData.liquidFee+baseData.priorMotoboyCredit-baseData.priorStoreCredit))):0;
  const cashSettlementInput=settlementStrategy==='separate'?true:settlementStrategy==='offset'?offsetReturn:manualCashInput;
  const data=useMemo(()=>motoboy?getMotoboyDayData(motoboy,date,routes,deliveries,existing?.settlement_adjustments||adjustments,cashSettlementInput,priorCarry):null,[adjustments,cashSettlementInput,date,deliveries,existing,motoboy,priorCarry,routes]);
  const days=useMemo(()=>{const first=new Date(month.getFullYear(),month.getMonth(),1);const start=new Date(first.getFullYear(),first.getMonth(),1-first.getDay());return Array.from({length:42},(_,index)=>{const day=new Date(start);day.setDate(start.getDate()+index);return day;});},[month]);

  if(!motoboy||!data)return <div><PageHeader title="Acerto indisponível" to="/motoboys"/></div>;

  const adjustmentKindLabel=(value:MotoboySettlementAdjustment|MotoboySettlementAdjustment['kind'])=>{
    const item=typeof value==='string'?undefined:value;
    const kind=typeof value==='string'?value:value.kind;
    if(item?.category_label)return item.category_label;
    return kind==='advance'?'Adiantamento':kind==='fuel'?'Combustível':kind==='consumption'||kind==='meal'?'Consumo / lanche':kind==='tip'?'Gorjeta':kind==='extra_fee'?'Taxa extra':kind==='gratification'?'Gratificação':kind==='extra_service'?'Serviço extra':kind==='bread_pickup'?'Busca de pães':kind==='addition'?'Outro acréscimo':'Outro ajuste';
  };

  // Se o dinheiro já foi entregue ao caixa, confirmar o acerto também quita
  // a diferença financeira do dia. Saldo só segue aberto quando o motoboy
  // permanece com o dinheiro das entregas.
  const cashHandedOver=data.retainedCash<=0;
  const carryForward=!cashHandedOver&&data.balance>0;

  const groupedExplanation=data.groupedOrderCount>0
    ? `${data.orderCount} pedidos viraram ${data.physicalDeliveryCount} paradas físicas porque ${data.groupedOrderCount} ${data.groupedOrderCount===1?'pedido compartilhou':'pedidos compartilharam'} endereço com outro pedido.`
    : `${data.orderCount} pedidos correspondem a ${data.physicalDeliveryCount} paradas físicas.`;
  const settlementEquation=data.settlementDirection==='motoboy_credit'
    ? `Diária líquida R$ ${money(data.liquidFee)} − dinheiro retido R$ ${money(data.retainedCash)} = loja paga R$ ${money(data.balance)}.`
    : data.settlementDirection==='store_credit'
      ? `Dinheiro retido R$ ${money(data.retainedCash)} − diária líquida R$ ${money(data.liquidFee)} = motoboy devolve R$ ${money(data.balance)}.`
      : `Dinheiro retido R$ ${money(data.retainedCash)} compensou exatamente a diária líquida.`;

  const settlementTitle=data.settlementDirection==='store_credit'
    ? `VALOR DA LOJA COM ${motoboy.name.toUpperCase()}`
    : data.settlementDirection==='settled'
      ? 'ACERTO ZERADO'
      : `VALOR A PAGAR PARA ${motoboy.name.toUpperCase()}`;

  const settlementExplanation=data.settlementDirection==='settled'
    ? 'Nenhum valor ficou pendente entre a loja e o motoboy.'
    : carryForward
      ? data.settlementDirection==='store_credit'
        ? `${motoboy.name} permanece com R$ ${money(data.balance)} da loja. O saldo irá para o próximo acerto.`
        : `A loja permanece devendo R$ ${money(data.balance)} a ${motoboy.name}. O saldo irá para o próximo acerto.`
      : `R$ ${money(data.balance)} serão quitados neste acerto. Nenhum saldo seguirá para o próximo.`;

  const addAdjustment=async()=>{
    if(adjustmentSubmitting.current||existing)return;
    const amount=parseMoneyDraft(adjustmentValue);
    if(existing)return void toast.error('Acerto já fechado. Não é possível alterar os ajustes.');
    const description=adjustmentDescription.trim();
    if(description.length<2)return void toast.error('Informe o motivo do ajuste.');
    if(!Number.isFinite(amount)||amount<=0)return void toast.error('Informe um valor válido.');
    const now=new Date().toISOString();
    adjustmentSubmitting.current=true;setAdjustmentBusy(true);
    try{
      await addMotoboyAdjustment({id:`adj-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,kind:adjustmentDirection==='addition'?'addition':'custom',direction:adjustmentDirection,category_label:description,description,amount,motoboy_id:motoboy.id,motoboy_name:motoboy.name,operational_date:date,status:'pending',author_uid:user?.uid,author_name:user?.displayName||user?.email||undefined,created_at:now,updated_at:now});
      setAdjustmentDescription('');setAdjustmentValue('');toast.success('Ajuste sincronizado.',{description:'Ele entrará automaticamente neste acerto.'});
    }catch(error){toast.error(error instanceof Error?error.message:'Não foi possível salvar o ajuste.');}
    finally{adjustmentSubmitting.current=false;setAdjustmentBusy(false);}
  };

  const summary=()=>{
    const [year,monthValue,day]=date.split('-');
    const lines=[
      `🧾 *ACERTO · DFL ENTREGAS*`,
      `🏍️ *Entregador:* ${motoboy.name}`,
      `📌 *Situação:* ${existing?'ACERTO REGISTRADO':'AGUARDANDO CONFERÊNCIA'}`,
      '──────────────────',
      `📅 *Data:* ${day}/${monthValue}/${year}`,
      '',
      `📦 *${data.orderCount} pedidos · ${data.physicalDeliveryCount} paradas físicas* · 🔁 *${data.completedRoutes} rotas*`,
      groupedExplanation,
      '',
      `🛣️ *CONTAGEM POR ROTA*`,
      ...data.routeBreakdown.map(item=>`↳ *${item.label}:* ${item.orderCount} pedido${item.orderCount===1?'':'s'} → ${item.physicalDeliveryCount} parada${item.physicalDeliveryCount===1?'':'s'}${item.groupedOrderCount>0?` · ${item.groupedOrderCount} agrupado${item.groupedOrderCount===1?'':'s'}`:''}`),
      '',
      '──────────────────',
      `💰 *DIÁRIA*`,
      data.fee.description,
      `*Acerto bruto: R$ ${money(data.fee.amount)}*`,
    ];
    if(data.priorStoreCredit>0||data.priorMotoboyCredit>0){
      const priorDate=priorSettlement?.occurred_at?new Date(priorSettlement.occurred_at).toLocaleDateString('pt-BR'):'acerto anterior';
      lines.push(
        '',
        `🔄 *SALDO ANTERIOR · ${priorDate}*`,
        data.priorStoreCredit>0
          ? `↳ R$ ${money(data.priorStoreCredit)} da loja estava com ${motoboy.name}`
          : `↳ A loja devia R$ ${money(data.priorMotoboyCredit)} a ${motoboy.name}`
      );
    }
    if(adjustments.length){
      lines.push(
        '',
        `➖ *ABATIMENTOS: - R$ ${money(data.totalVales)}*`,
        `_Composição do total:_`
      );
      adjustments.filter(item=>item.direction!=='addition').forEach(item=>lines.push(`↳ - ${adjustmentKindLabel(item)} · ${item.description} · R$ ${money(item.amount)}`));
    }
    if(data.totalAdditions>0){
      lines.push('',`➕ *ACRÉSCIMOS: + R$ ${money(data.totalAdditions)}*`,`_Composição do total:_`);
      adjustments.filter(item=>item.direction==='addition').forEach(item=>lines.push(`↳ + ${adjustmentKindLabel(item)} · ${item.description} · R$ ${money(item.amount)}`));
    }
    lines.push(
      '',
      `💵 *DINHEIRO EM MÃOS*`,
      `Clientes entregaram em espécie: *R$ ${money(data.cashInHand)}*`,
      `(-) Troco bancado pela loja: *R$ ${money(data.cashChange)}*`,
      `(=) Vendas líquidas em dinheiro: *R$ ${money(data.cashCollected)}*`,
      `Devolvido fisicamente à loja: *R$ ${money(data.cashHandedOverAmount)}*`,
      `Modo: *${settlementStrategy==='separate'?'caixa separado':settlementStrategy==='offset'?'compensar diária':'ajuste manual'}*`,
      data.retainedCash>0 ? `↳ Com o motoboy: *R$ ${money(data.retainedCash)}*` : `↳ Caixa conferido integralmente na loja`,
      '',
      '──────────────────',
      `🏪 *RESULTADO DO ACERTO*`,
      `*R$ ${money(data.balance)} · ${settlementTitle}*`,
      settlementEquation,
      settlementExplanation
    );
    return lines.join('\n');
  };

  const confirm=async()=>{
    if(settlementInFlight.current)return;
    if(existing)return void toast.info('Este dia já possui acerto registrado.');
    if(data.fee.amount<=0)return void toast.error('Não há valor de acerto para registrar.');
    if(!data.routes.length)return void toast.error('Não existem rotas deste motoboy nesta data.');

    const openRoutes=data.routes.filter(route=>route.status!=='fechada');
    const routeIds=new Set(data.routes.map(route=>route.id));
    const pending=activeRouteDeliveries(deliveries).filter(delivery=>routeIds.has(delivery.route_id)&&!delivery.completed);
    if(openRoutes.length||pending.length)return void toast.error('Finalize a operação antes de confirmar o acerto.',{description:`${openRoutes.length} rota(s) aberta(s) · ${pending.length} entrega(s) pendente(s).`});

    const now=new Date().toISOString();
    settlementInFlight.current=true;
    setSaving(true);
    try{
      await closeMotoboySettlement({
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
        operational_date:date,
        schema_version:2,
        closed_by_uid:user?.uid,
        closed_by_name:user?.displayName||user?.email||undefined,
        settlement_gross_amount:data.fee.amount,
        settlement_net_payable:data.liquidFee,
        settlement_cash_balance:data.balance,
        settlement_adjustments:adjustments,
        settlement_delivery_count:data.physicalDeliveryCount,
        settlement_route_count:data.completedRoutes,
        settlement_cash_collected:data.cashCollected,
        settlement_cash_tendered:data.cashTendered,
        settlement_cash_in_hand:data.cashInHand,
        settlement_cash_change:data.cashChange,
        settlement_cash_handed_over_amount:data.cashHandedOverAmount,
        settlement_cash_retained:data.retainedCash,
        settlement_store_credit:data.storeCredit,
        settlement_motoboy_credit:data.motoboyCredit,
        settlement_carry_forward:carryForward,
        settlement_direction:data.settlementDirection,
        settlement_cash_handed_over:cashHandedOver,
        settlement_strategy:settlementStrategy,
        observation:`${data.physicalDeliveryCount} entregas físicas · ${data.orderCount} pedidos · ${data.completedRoutes} rotas · custo bruto R$ ${money(data.fee.amount)} · abatimentos R$ ${money(data.totalVales)} · líquido do motoboy R$ ${money(data.liquidFee)} · caixa R$ ${money(data.balance)} · saldo futuro ${carryForward?'sim':'não'}`,
        created_at:now,
        updated_at:now,
      },sharedAdjustments.map(item=>item.id));
      try{window.localStorage.removeItem(draftKey);}catch{}
      toast.success('Acerto confirmado e lançado em despesas.');
    }catch(error){toast.error(error instanceof Error?error.message:'Não foi possível confirmar o acerto.');}
    finally{settlementInFlight.current=false;setSaving(false);}
  };

  const copy=async()=>{
    if(copyInFlight.current)return;
    copyInFlight.current=true;setCopyBusy(true);
    try{
      if(!navigator.clipboard?.writeText)throw new Error('Clipboard indisponível');
      await navigator.clipboard.writeText(summary());
      toast.success('Resumo copiado.');
    }catch{toast.error('Não foi possível copiar o resumo.',{description:'Confira a permissão da área de transferência e tente novamente.'});}
    finally{copyInFlight.current=false;setCopyBusy(false);}
  };
  // Compartilhamento unificado: texto e imagem quando suportado; cópia independente como alternativa.
  const image=async()=>{
    if(imageBusy)return;
    setImageBusy(true);
    try{
    const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1400;
    const ctx=canvas.getContext('2d');if(!ctx)return void toast.error('Não foi possível gerar a imagem.');
    const round=(x:number,y:number,w:number,h:number,r:number,fill:string,stroke?:string)=>{ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}};
    const gradient=ctx.createLinearGradient(0,0,1080,1400);gradient.addColorStop(0,'#09231f');gradient.addColorStop(.44,'#090e13');gradient.addColorStop(1,'#09090d');ctx.fillStyle=gradient;ctx.fillRect(0,0,1080,1400);
    ctx.fillStyle='#10b981';ctx.fillRect(0,0,1080,12);
    await paintDflBrand(ctx,64,65,102);
    const label=(value:string,x:number,y:number,font:string,color:string,maxWidth:number)=>{ctx.textAlign='left';ctx.font=font;ctx.fillStyle=color;ctx.fillText(paintFittedText(ctx,value,maxWidth),x,y);};
    label('DFL ENTREGAS',190,103,'900 30px Arial','#34d399',790);
    label('ACERTO DO MOTOBOY',190,148,'900 41px Arial','#f8fafc',820);
    label(motoboy.name,64,238,'900 50px Arial','#f8fafc',700);
    label(fromKey(date).toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}),65,283,'600 25px Arial','#94a3b8',860);
    round(48,321,984,157,27,'#10282b','#1c4141');
    const metric=(x:number,head:string,value:string)=>{label(head,x,369,'800 23px Arial','#94a3b8',280);label(value,x,427,'900 41px Arial','#f8fafc',280);};
    metric(78,'PARADAS',String(data.physicalDeliveryCount));metric(393,'ROTAS',String(data.completedRoutes));metric(697,'DIÁRIA BRUTA',`R$ ${money(data.fee.amount)}`);
    round(48,505,984,355,30,'#171b20','#2c3339');
    label('COMPOSIÇÃO DA DIÁRIA',80,565,'900 28px Arial','#d4d4d8',900);
    const financeRow=(name:string,value:string,y:number,color='#f8fafc')=>{
      label(name,82,y,'700 28px Arial','#a3abb4',570);
      ctx.textAlign='right';ctx.font='900 31px Arial';ctx.fillStyle=color;ctx.fillText(value,995,y);ctx.textAlign='left';
    };
    financeRow('Valor da diária',`R$ ${money(data.fee.amount)}`,632);
    financeRow('Acréscimos',`+ R$ ${money(data.totalAdditions)}`,706,'#34d399');
    financeRow('Abatimentos',`− R$ ${money(data.totalVales)}`,780,'#fb7185');
    ctx.fillStyle='#343b42';ctx.fillRect(81,815,913,2);
    label('DIÁRIA LÍQUIDA',82,846,'900 24px Arial','#d4d4d8',550);
    ctx.textAlign='right';ctx.font='900 36px Arial';ctx.fillStyle='#6ee7b7';ctx.fillText(`R$ ${money(data.liquidFee)}`,994,851);ctx.textAlign='left';
    round(48,884,984,211,30,'#102229','#234148');
    label('DINHEIRO RECEBIDO DOS CLIENTES',80,933,'900 26px Arial','#7dd3fc',900);
    financeRow('Recebido pelo motoboy',`R$ ${money(data.cashInHand)}`,995);
    financeRow('Devolvido à loja',`R$ ${money(data.cashHandedOverAmount)}`,1053,'#f8fafc');
    round(48,1117,984,204,33,data.settlementDirection==='store_credit'?'#8c5d12':data.settlementDirection==='settled'?'#243641':'#065f46');
    const direction=data.settlementDirection==='store_credit'?'MOTOBOY DEVOLVE À LOJA':data.settlementDirection==='settled'?'ACERTO QUITADO':'LOJA PAGA AO MOTOBOY';
    label(direction,80,1164,'900 28px Arial','#f8fafc',910);
    label(`R$ ${money(data.balance)}`,80,1238,'900 65px Arial','#ffffff',850);
    label(data.retainedCash>0?`Ainda com o motoboy: R$ ${money(data.retainedCash)}`:'Dinheiro da rota conferido no caixa',80,1290,'700 23px Arial','#e2e8f0',910);
    label('DFL ENTREGAS  •  RESUMO DE CONFERÊNCIA',60,1363,'700 21px Arial','#7b919a',930);
    const dataUrl=canvas.toDataURL('image/png',1);const filename=`acerto-${motoboy.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}-${date}.png`;
    if(Capacitor.isNativePlatform()){const saved=await Filesystem.writeFile({path:`dfl-acertos/${filename}`,data:dataUrl.split(',')[1],directory:Directory.Cache,recursive:true});await Share.share({title:`Acerto · ${motoboy.name}`,text:summary(),files:[saved.uri],dialogTitle:'Compartilhar comprovante'});toast.success('Imagem gerada. Escolha onde compartilhar.');return;}
    const blob=await (await fetch(dataUrl)).blob();const file=new File([blob],filename,{type:'image/png'});if(navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({title:`Acerto · ${motoboy.name}`,text:summary(),files:[file]});return;}const link=document.createElement('a');link.download=filename;link.href=dataUrl;link.click();toast.info('Imagem baixada. Use Copiar resumo para enviar também o texto.');
    }catch(error){if(error instanceof Error&&/cancel/i.test(error.message))return;console.error('[ACERTO] Falha ao gerar imagem:',error);toast.error('Não foi possível gerar ou compartilhar a imagem.');}finally{setImageBusy(false);}
  };

  return <div className="flex flex-col gap-4 pb-28">
    <PageHeader title="Acerto do motoboy" subtitle={motoboy.name} to={`/motoboys/details?id=${motoboy.id}`}/>
    <section className="rounded-[22px] border border-zinc-800 bg-gradient-to-br from-zinc-900/70 to-zinc-950/60 px-4 py-3">
      <div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.12em] text-emerald-300">Fechamento financeiro</p><p className="mt-1 text-base font-black text-zinc-100">{motoboy.name}</p><p className="mt-1 text-[11px] text-zinc-400">{data.completedRoutes} rotas · {data.physicalDeliveryCount} paradas · {data.orderCount} pedidos</p></div><div className={`shrink-0 rounded-xl border px-3 py-2 text-[10px] font-black ${existing?'border-emerald-500/30 bg-emerald-500/10 text-emerald-300':'border-amber-500/20 bg-amber-500/[.06] text-amber-300'}`}>{existing?'Fechado':'Conferência'}</div></div>
    </section>
    <div className="flex items-center gap-2 rounded-[22px] border border-zinc-800 bg-zinc-900/45 p-2"><button onClick={()=>setDate(value=>shift(value,-1))} className="date-button"><ChevronLeft/></button><button onClick={()=>{setMonth(fromKey(date));setCalendar(true)}} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-zinc-800 text-sm font-black"><CalendarDays size={17} className="text-emerald-400"/>{fromKey(date).toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'short'}).replaceAll('.','')}</button><button onClick={()=>setDate(value=>shift(value,1))} className="date-button"><ChevronRight/></button></div>

    {existing&&<div className="flex justify-end"><span className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[.05] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-emerald-300"><ShieldCheck size={14}/>Fechado e protegido</span></div>}
    {existing&&<section className="rounded-[22px] border border-emerald-500/20 bg-emerald-500/[.05] p-4"><p className="text-[9px] font-black uppercase tracking-[.15em] text-emerald-400">{typeof existing.settlement_gross_amount==='number'?'Acerto registrado':'Acerto registrado · legado'}</p><p className="mt-2 text-xl font-black text-emerald-300">R$ {money(existing.settlement_gross_amount ?? existing.amount)}</p><p className="mt-1 text-[10px] text-zinc-500">{typeof existing.settlement_gross_amount==='number'?'Custo operacional bruto do motoboy. O dinheiro recebido de clientes fica separado como liquidação de caixa.':'Valor originalmente registrado. Este acerto é anterior à separação entre custo bruto, abatimentos e caixa; o histórico não foi recalculado automaticamente.'}</p></section>}

    <div className="grid grid-cols-2 gap-3"><Card icon={Package} label={data.orderCount===data.physicalDeliveryCount?"Entregas concluídas":`${data.orderCount} pedidos`} value={String(data.physicalDeliveryCount)} tone="sky"/><Card icon={Banknote} label="Recebido · antes do troco" value={`R$ ${money(data.cashTendered)}`} tone="amber"/></div>

    {(data.priorStoreCredit>0||data.priorMotoboyCredit>0)&&<section className="rounded-[22px] border border-amber-500/20 bg-amber-500/[.055] p-4"><p className="text-[9px] font-black uppercase tracking-[.15em] text-amber-400">Saldo trazido do acerto anterior</p><p className="mt-2 text-lg font-black text-amber-200">R$ {money(data.priorStoreCredit||data.priorMotoboyCredit)}</p><p className="mt-1 text-[10px] leading-relaxed text-zinc-500">{data.priorStoreCredit>0?`${motoboy.name} estava com este valor da loja. Ele será compensado automaticamente hoje.`:`A loja devia este valor a ${motoboy.name}. Ele será somado automaticamente ao acerto de hoje.`}</p></section>}

    <section className="rounded-[22px] border border-sky-500/20 bg-sky-500/[.035] p-4"><div className="flex items-center justify-between gap-3"><p className="text-[11px] font-black uppercase tracking-wider text-sky-300">Prévia do acerto</p><span className="rounded-lg bg-zinc-950/65 px-2.5 py-1 text-[10px] font-bold text-zinc-400">{adjustments.length} ajuste(s)</span></div><div className="mt-4 space-y-3"><Line label="Acerto bruto" value={`R$ ${money(data.fee.amount)}`}/><p className="text-[10px] text-zinc-500">{data.fee.description}</p>{adjustments.map(item=><div key={item.id} className="flex items-center gap-2"><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-zinc-300">{item.description}</p><p className="text-[9px] text-zinc-600">{adjustmentKindLabel(item.kind)} · {item.direction==='addition'?'acréscimo':'abatimento'}</p></div><span className={`text-xs font-black ${item.direction==='addition'?'text-emerald-400':'text-red-400'}`}>{item.direction==='addition'?'+':'-'} R$ {money(item.amount)}</span><button disabled={Boolean(existing)} onClick={()=>setPendingRemoval(item)} aria-label={`Excluir ajuste ${item.description}`} className="grid h-8 w-8 place-items-center rounded-xl text-red-500"><Trash2 size={13}/></button></div>)}<div className="border-t border-sky-500/10 pt-3"><Line label="Total dos abatimentos" value={`- R$ ${money(data.totalVales)}`}/><Line label="Total dos acréscimos" value={`+ R$ ${money(data.totalAdditions)}`}/><Line label="Líquido do motoboy" value={`R$ ${money(data.liquidFee)}`} strong/></div></div></section>

    <button type="button" aria-expanded={showAdjustmentForm} onClick={()=>setShowAdjustmentForm(value=>!value)} disabled={Boolean(existing)} className="flex min-h-12 w-full items-center justify-between rounded-2xl border border-amber-500/20 bg-amber-500/[.04] px-4 py-3 text-left text-xs font-black text-amber-200 disabled:opacity-50"><span className="flex items-center gap-2"><Plus size={16}/> {showAdjustmentForm ? 'Recolher novo ajuste' : 'Adicionar acréscimo ou abatimento'}</span><ChevronRight size={16} className={showAdjustmentForm?'rotate-90 transition-transform':'transition-transform'}/></button>
    {showAdjustmentForm && <section className="rounded-[22px] border border-zinc-800 bg-zinc-900/35 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Novo ajuste</p><p className="mt-1 text-[10px] text-zinc-600">Digite o motivo; ele fica sincronizado e entra uma única vez no fechamento.</p><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" aria-pressed={adjustmentDirection==='deduction'} disabled={adjustmentBusy||Boolean(existing)} onClick={()=>setAdjustmentDirection('deduction')} className={`h-11 rounded-xl border text-xs font-black ${adjustmentDirection==='deduction'?'border-red-500/35 bg-red-500/10 text-red-300':'border-zinc-800 text-zinc-500'}`}>− Abatimento</button><button type="button" aria-pressed={adjustmentDirection==='addition'} disabled={adjustmentBusy||Boolean(existing)} onClick={()=>setAdjustmentDirection('addition')} className={`h-11 rounded-xl border text-xs font-black ${adjustmentDirection==='addition'?'border-emerald-500/35 bg-emerald-500/10 text-emerald-300':'border-zinc-800 text-zinc-500'}`}>+ Acréscimo</button></div><div className="mt-3 grid grid-cols-[minmax(0,1fr)_92px_48px] gap-2"><input aria-label="Motivo do ajuste" disabled={adjustmentBusy||Boolean(existing)} value={adjustmentDescription} onChange={e=>setAdjustmentDescription(e.target.value)} maxLength={60} placeholder="Motivo: lanche, combustível..." className="input"/><input aria-label="Valor do ajuste" disabled={adjustmentBusy||Boolean(existing)} value={adjustmentValue} onChange={e=>setAdjustmentValue(normalizeMoneyDraft(e.target.value))} inputMode="numeric" placeholder="0,00" className="input text-right font-black"/><button disabled={Boolean(existing)||adjustmentBusy} onClick={addAdjustment} aria-label={adjustmentBusy?"Salvando ajuste":"Adicionar ajuste"} aria-busy={adjustmentBusy} className="flex h-12 items-center justify-center rounded-xl bg-amber-400 text-zinc-950 disabled:opacity-40">{adjustmentBusy?<span className="text-[10px] font-black">...</span>:<Plus size={18}/>}</button></div><p role="status" className="mt-2 text-[10px] text-zinc-500">{adjustmentBusy?"Salvando ajuste no sistema…":"Informe o motivo e o valor antes de adicionar."}</p></section>}

    <section className="rounded-[22px] border border-zinc-800 bg-zinc-900/35 p-4"><div className="flex items-center gap-2"><Banknote size={16} className="text-emerald-400"/><p className="text-sm font-black">Como fechar o caixa?</p></div><p className="mt-1 text-[10px] leading-relaxed text-zinc-500">Clientes entregaram R$ {money(data.cashInHand)}. Tirando R$ {money(data.cashChange)} de troco bancado pela loja, as vendas líquidas são R$ {money(data.cashCollected)}.</p><div className="mt-3 grid gap-2"><button type="button" aria-pressed={settlementStrategy==='separate'} disabled={saving||Boolean(existing)} onClick={()=>setSettlementStrategy('separate')} className={`rounded-2xl border p-3 text-left ${settlementStrategy==='separate'?'border-emerald-500/40 bg-emerald-500/10':'border-zinc-800'}`}><span className="block text-xs font-black">Caixa separado</span><span className="mt-1 block text-[9px] text-zinc-500">Devolve R$ {money(data.cashInHand)} e a diária é paga à parte.</span></button><button type="button" aria-pressed={settlementStrategy==='offset'} disabled={saving||Boolean(existing)} onClick={()=>setSettlementStrategy('offset')} className={`rounded-2xl border p-3 text-left ${settlementStrategy==='offset'?'border-sky-500/40 bg-sky-500/10':'border-zinc-800'}`}><span className="block text-xs font-black">Compensar diária nas vendas</span><span className="mt-1 block text-[9px] text-zinc-500">Retém no máximo R$ {money(data.cashCollected)} das vendas; dinheiro do troco nunca entra na diária.</span></button><button type="button" aria-pressed={settlementStrategy==='manual'} disabled={saving||Boolean(existing)} onClick={()=>setSettlementStrategy('manual')} className={`rounded-2xl border p-3 text-left ${settlementStrategy==='manual'?'border-amber-500/40 bg-amber-500/10':'border-zinc-800'}`}><span className="block text-xs font-black">Conferência manual</span><span className="mt-1 block text-[9px] text-zinc-500">Use somente quando o valor físico devolvido for diferente.</span></button></div>{settlementStrategy==='manual'&&<><div className="mt-3 grid grid-cols-3 gap-2">{([['all','Tudo'],['partial','Informar'],['none','Nada']] as const).map(([value,label])=><button key={value} type="button" aria-pressed={cashMode===value} disabled={saving||Boolean(existing)} onClick={()=>{setCashMode(value);if(value==='partial'&&!cashHandedDraft)setCashHandedDraft(moneyValueToDraft(data.cashInHand))}} className={`min-h-11 rounded-xl border px-2 text-[10px] font-black ${cashMode===value?'border-amber-500/35 bg-amber-500/10 text-amber-200':'border-zinc-800 text-zinc-600'}`}>{label}</button>)}</div>{cashMode==='partial'&&<label className="mt-3 block text-[10px] font-bold text-zinc-500">Quanto voltou fisicamente para a loja?<input value={cashHandedDraft} disabled={saving||Boolean(existing)} onChange={e=>setCashHandedDraft(normalizeMoneyDraft(e.target.value))} inputMode="numeric" className="input mt-2 w-full text-right text-sm font-black text-zinc-100" placeholder="0,00"/></label>}</>}<div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-zinc-950/60 p-3"><Line label="Voltou para a loja" value={`R$ ${money(data.cashHandedOverAmount)}`}/><Line label="Retido pelo motoboy" value={`R$ ${money(data.retainedCash)}`}/></div><p className="mt-2 text-[10px] font-bold leading-relaxed text-sky-300">{settlementEquation}</p><p className="mt-2 text-[9px] leading-relaxed text-zinc-600">Pix enviado ao motoboy deve ser lançado como Adiantamento.</p></section>

    <section className={`rounded-[22px] border p-4 shadow-[0_12px_32px_rgba(0,0,0,.15)] ${data.settlementDirection==='store_credit'?'border-amber-400/40 bg-amber-500':'border-emerald-400/40 bg-emerald-500'}`}><div className="flex items-center justify-between text-zinc-950"><p className="text-[10px] font-black uppercase tracking-wider">Resultado do acerto</p>{data.settlementDirection==='store_credit'?<ArrowDownLeft/>:<ArrowUpRight/>}</div><p className="mt-1 break-words text-[clamp(1.65rem,8vw,2.25rem)] font-black tabular-nums text-zinc-950">R$ {money(data.balance)}</p><p className="mt-1 text-xs font-black uppercase text-zinc-900">{settlementTitle}</p><p className="mt-2 max-w-[32rem] text-[11px] font-bold leading-relaxed text-zinc-900/80">{settlementExplanation}</p></section>

    <button disabled={saving||Boolean(existing)} onClick={confirm} className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-sm font-black text-zinc-950 disabled:opacity-40"><ReceiptText size={17}/>{existing?'Acerto já registrado':saving?'Confirmando...':'Confirmar acerto'}</button>
    <div className="grid grid-cols-2 gap-2"><button disabled={copyBusy} aria-busy={copyBusy} onClick={copy} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-zinc-800 text-[11px] font-black text-zinc-300"><Copy size={14}/>{copyBusy?'Copiando...':'Copiar resumo'}</button><button disabled={imageBusy} onClick={()=>void image()} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/10 text-[11px] font-black text-emerald-200 disabled:opacity-40"><ImageIcon size={14}/>{imageBusy?'Gerando...':'Compartilhar acerto'}</button></div>


    {pendingRemoval && <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/80 px-3 pb-[calc(var(--dfl-safe-bottom)+12px)] backdrop-blur-sm" onClick={()=>{if(!removalBusy)setPendingRemoval(null);}}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="dfl-adjust-remove-title" aria-describedby="dfl-adjust-remove-description" className="w-full max-w-md rounded-[26px] border border-zinc-700 bg-zinc-950 p-5 shadow-2xl" onClick={event=>event.stopPropagation()}>
        <div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-red-500/20 bg-red-500/10 text-red-400"><Trash2 size={20}/></span><div className="min-w-0 flex-1"><h2 id="dfl-adjust-remove-title" className="text-base font-black text-zinc-100">Excluir este ajuste?</h2><p id="dfl-adjust-remove-description" className="mt-1 text-xs leading-relaxed text-zinc-400">{pendingRemoval.description} · R$ {money(pendingRemoval.amount)}. O histórico financeiro será preservado; este ajuste deixará de compor o acerto.</p></div></div>
        <div className="mt-5 grid grid-cols-2 gap-3"><button type="button" disabled={removalBusy} onClick={()=>setPendingRemoval(null)} className="min-h-12 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs font-bold text-zinc-200 disabled:opacity-50">Manter ajuste</button><button type="button" disabled={removalBusy} onClick={async()=>{if(!pendingRemoval||removalBusy)return;setRemovalBusy(true);try{await cancelMotoboyAdjustment(pendingRemoval.id);setPendingRemoval(null);toast.success('Ajuste excluído da prévia.');}catch(error){toast.error(error instanceof Error?error.message:'Falha ao excluir ajuste.');}finally{setRemovalBusy(false);}}} className="min-h-12 rounded-xl bg-red-500 px-3 text-xs font-black text-white disabled:opacity-50">{removalBusy?'Excluindo…':'Excluir ajuste'}</button></div>
      </div>
    </div>}

    {calendar&&<div className="fixed inset-0 z-50 flex items-end bg-black/75 p-3 backdrop-blur-sm" onClick={()=>setCalendar(false)}><div role="dialog" aria-modal="true" aria-label="Selecionar dia do acerto" className="max-h-[85dvh] w-full overflow-y-auto rounded-[30px] border border-zinc-800 bg-zinc-950 p-5 pb-[calc(var(--dfl-safe-bottom)+20px)]" onClick={e=>e.stopPropagation()}><div className="mb-4 flex items-center justify-between"><button onClick={()=>setMonth(value=>new Date(value.getFullYear(),value.getMonth()-1,1))} className="date-button"><ChevronLeft/></button><p className="font-black capitalize">{month.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</p><button onClick={()=>setMonth(value=>new Date(value.getFullYear(),value.getMonth()+1,1))} className="date-button"><ChevronRight/></button></div><div className="grid grid-cols-7 text-center text-[10px] text-zinc-600">{['D','S','T','Q','Q','S','S'].map((label,index)=><span key={`${label}-${index}`}>{label}</span>)}</div><div className="mt-2 grid grid-cols-7 gap-1">{days.map(day=>{const key=operationalDateKey(day);return <button key={key} onClick={()=>{setDate(key);setCalendar(false)}} className={`aspect-square rounded-xl text-xs font-bold ${key===date?'bg-emerald-500 text-zinc-950':day.getMonth()===month.getMonth()?'text-zinc-300':'text-zinc-700'}`}>{day.getDate()}</button>})}</div><button onClick={()=>setCalendar(false)} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 text-xs font-bold text-zinc-400"><X size={15}/>Fechar</button></div></div>}

    <style jsx>{`.date-button{display:flex;height:2.75rem;width:2.75rem;align-items:center;justify-content:center;border-radius:1rem;color:rgb(113 113 122)}.input{height:3rem;min-width:0;border-radius:.75rem;border:1px solid rgb(39 39 42);background:rgb(24 24 27/.6);padding:0 .75rem;font-size:.75rem;outline:none}`}</style>
  </div>
}

function Line({label,value,strong=false}:{label:string;value:string;strong?:boolean}){return <div className="flex items-center justify-between gap-3"><span className={`text-xs ${strong?'font-black text-zinc-200':'text-zinc-500'}`}>{label}</span><span className={`${strong?'text-lg text-emerald-300':'text-sm text-zinc-300'} font-black`}>{value}</span></div>}
function Card({icon:Icon,label,value,tone}:{icon:typeof Package;label:string;value:string;tone:'sky'|'amber'}){return <div className={`rounded-[22px] border p-4 ${tone==='sky'?'border-sky-500/20 bg-sky-500/5':'border-amber-500/20 bg-amber-500/5'}`}><Icon size={16} className={tone==='sky'?'text-sky-400':'text-amber-400'}/><p className="mt-3 text-xl font-black">{value}</p><p className="text-[10px] text-zinc-500">{label}</p></div>}
export default function MotoboySettlementPage(){return <Suspense fallback={<p className="py-20 text-center text-zinc-500">Carregando...</p>}><Content/></Suspense>}
