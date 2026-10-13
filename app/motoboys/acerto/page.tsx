'use client';
import { Suspense,useMemo,useState } from 'react';
import { useRouter,useSearchParams } from 'next/navigation';
import { ArrowDown,ArrowDownLeft,ArrowUp,ArrowUpRight,Banknote,CalendarDays,ChevronLeft,ChevronRight,Copy,Image as ImageIcon,Package,Plus,ReceiptText,Send,Trash2,X } from 'lucide-react';
import { toast } from '@/lib/operational-toast';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAppStore } from '@/store/useAppStore';
import { getMotoboyDayData,operationalDateKey } from '@/lib/motoboy-analytics';
import { moneyValueToDraft,normalizeMoneyDraft,parseMoneyDraft } from '@/lib/route-cash-flow';
import type { MotoboySettlementAdjustment,MotoboySettlementCategory } from '@/types';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const fromKey=(key:string)=>new Date(`${key}T12:00:00-03:00`);
const shift=(key:string,days:number)=>{const date=fromKey(key);date.setDate(date.getDate()+days);return operationalDateKey(date);};
const money=(value:number)=>value.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const DEFAULT_CATEGORIES:MotoboySettlementCategory[]=[
  {id:'advance',label:'Adiantamento',direction:'deduction',position:0},
  {id:'fuel',label:'Combustível',direction:'deduction',position:1},
  {id:'consumption',label:'Consumo / lanche',direction:'deduction',position:2},
  {id:'tip',label:'Gorjeta',direction:'addition',position:0},
  {id:'extra_fee',label:'Taxa extra',direction:'addition',position:1},
  {id:'gratification',label:'Gratificação',direction:'addition',position:2},
];

function Content(){
  const router=useRouter();
  const params=useSearchParams();
  const id=params.get('id');
  const motoboy=useAppStore(state=>state.motoboys.find(item=>item.id===id));
  const routes=useAppStore(state=>state.routes);
  const deliveries=useAppStore(state=>state.deliveries);
  const addOperationalExpense=useAppStore(state=>state.addOperationalExpense);
  const operationalExpenses=useAppStore(state=>state.operationalExpenses);
  const storeSettings=useAppStore(state=>state.storeSettings);
  const updateStoreSettings=useAppStore(state=>state.updateStoreSettings);

  const paramDate=params.get('date');
  const [date,setDate]=useState(()=>paramDate&&/^\d{4}-\d{2}-\d{2}$/.test(paramDate)?paramDate:operationalDateKey(new Date()));
  const [month,setMonth]=useState(()=>fromKey(date));
  const [calendar,setCalendar]=useState(false);
  const [adjustments,setAdjustments]=useState<MotoboySettlementAdjustment[]>([]);
  const [adjustmentKind,setAdjustmentKind]=useState<MotoboySettlementAdjustment['kind']>('advance');
  const [adjustmentCategoryId,setAdjustmentCategoryId]=useState('advance');
  const [adjustmentDirection,setAdjustmentDirection]=useState<'deduction'|'addition'>('deduction');
  const [adjustmentDescription,setAdjustmentDescription]=useState('');
  const [adjustmentValue,setAdjustmentValue]=useState('');
  const [categoryManager,setCategoryManager]=useState(false);
  const [newCategoryName,setNewCategoryName]=useState('');
  const [savingCategory,setSavingCategory]=useState(false);
  const [settlementStrategy,setSettlementStrategy]=useState<'separate'|'offset'|'manual'>('separate');
  const [cashMode,setCashMode]=useState<'all'|'none'|'partial'>('all');
  const [cashHandedDraft,setCashHandedDraft]=useState('');
  const [saving,setSaving]=useState(false);
  const [imageBusy,setImageBusy]=useState(false);

  const customCategories=(storeSettings.settlementAdjustmentCategories||[]).filter(item=>item.custom!==false).sort((a,b)=>a.position-b.position);
  const directionCategories=[...DEFAULT_CATEGORIES.filter(item=>item.direction===adjustmentDirection),...customCategories.filter(item=>item.direction===adjustmentDirection)];
  const selectedCategory=directionCategories.find(item=>item.id===adjustmentCategoryId)||directionCategories[0];
  const manualCashInput=cashMode==='all'?true:cashMode==='none'?false:parseMoneyDraft(cashHandedDraft);

  const sourceId=motoboy?`motoboy:${motoboy.id}:${date}`:'';
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
  const baseData=useMemo(()=>motoboy?getMotoboyDayData(motoboy,date,routes,deliveries,adjustments,true,priorCarry):null,[adjustments,date,deliveries,motoboy,priorCarry,routes]);
  const offsetReturn=baseData?Math.max(0,baseData.cashInHand-Math.min(baseData.cashCollected,Math.max(0,baseData.liquidFee+baseData.priorMotoboyCredit-baseData.priorStoreCredit))):0;
  const cashSettlementInput=settlementStrategy==='separate'?true:settlementStrategy==='offset'?offsetReturn:manualCashInput;
  const data=useMemo(()=>motoboy?getMotoboyDayData(motoboy,date,routes,deliveries,adjustments,cashSettlementInput,priorCarry):null,[adjustments,cashSettlementInput,date,deliveries,motoboy,priorCarry,routes]);
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

  const saveCustomCategory=async()=>{
    const label=newCategoryName.trim();
    if(label.length<2)return void toast.error('Digite um nome para a categoria.');
    if([...DEFAULT_CATEGORIES,...customCategories].some(item=>item.direction===adjustmentDirection&&item.label.toLocaleLowerCase('pt-BR')===label.toLocaleLowerCase('pt-BR')))return void toast.error('Essa categoria já existe.');
    const category:MotoboySettlementCategory={id:`custom-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,label,direction:adjustmentDirection,position:customCategories.filter(item=>item.direction===adjustmentDirection).length,custom:true};
    setSavingCategory(true);
    try{await updateStoreSettings({settlementAdjustmentCategories:[...customCategories,category]});setAdjustmentCategoryId(category.id);setAdjustmentKind('custom');setNewCategoryName('');setCategoryManager(false);toast.success('Categoria salva no banco de dados.');}
    catch{toast.error('Não foi possível salvar a categoria.');}
    finally{setSavingCategory(false);}
  };

  const moveCustomCategory=async(id:string,direction:-1|1)=>{
    const same=customCategories.filter(item=>item.direction===adjustmentDirection);
    const index=same.findIndex(item=>item.id===id);const target=index+direction;
    if(index<0||target<0||target>=same.length)return;
    [same[index],same[target]]=[same[target],same[index]];
    const reordered=customCategories.map(item=>item.direction===adjustmentDirection?{...item,position:same.findIndex(value=>value.id===item.id)}:item);
    try{await updateStoreSettings({settlementAdjustmentCategories:reordered});}catch{toast.error('Não foi possível reordenar.');}
  };

  const addAdjustment=()=>{
    const amount=parseMoneyDraft(adjustmentValue);
    if(!selectedCategory||!Number.isFinite(amount)||amount<=0)return void toast.error('Escolha a categoria e informe o valor.');
    const description=adjustmentDescription.trim()||selectedCategory.label;
    setAdjustments(current=>[...current,{id:`adj-${Date.now()}`,kind:selectedCategory.custom?'custom':selectedCategory.id as MotoboySettlementAdjustment['kind'],direction:adjustmentDirection,category_id:selectedCategory.id,category_label:selectedCategory.label,description,amount}]);
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
      `📦 *${data.orderCount} pedidos · ${data.physicalDeliveryCount} paradas físicas* · 🔁 *${data.completedRoutes} rotas*`,
      groupedExplanation,
      '',
      `🛣️ *CONTAGEM POR ROTA*`,
      ...data.routeBreakdown.map(item=>`↳ *${item.label}:* ${item.orderCount} pedido${item.orderCount===1?'':'s'} → ${item.physicalDeliveryCount} parada${item.physicalDeliveryCount===1?'':'s'}${item.groupedOrderCount>0?` · ${item.groupedOrderCount} agrupado${item.groupedOrderCount===1?'':'s'}`:''}`),
      '',
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
      `🏪 *RESULTADO DO ACERTO*`,
      `*R$ ${money(data.balance)} · ${settlementTitle}*`,
      settlementEquation,
      settlementExplanation
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
    const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1700;
    const ctx=canvas.getContext('2d');if(!ctx)return void toast.error('Não foi possível gerar a imagem.');
    const round=(x:number,y:number,w:number,h:number,r:number,fill:string,stroke?:string)=>{ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}};
    const gradient=ctx.createLinearGradient(0,0,1080,1700);gradient.addColorStop(0,'#07130f');gradient.addColorStop(.48,'#09090b');gradient.addColorStop(1,'#111116');ctx.fillStyle=gradient;ctx.fillRect(0,0,1080,1350);
    ctx.fillStyle='#10b981';ctx.fillRect(0,0,1080,16);ctx.globalAlpha=.16;ctx.beginPath();ctx.arc(960,70,290,0,Math.PI*2);ctx.fillStyle='#10b981';ctx.fill();ctx.globalAlpha=1;
    round(64,64,952,190,38,'rgba(24,24,27,.88)','#27332f');round(88,88,76,76,22,'#10b981');ctx.fillStyle='#052e22';ctx.font='900 29px Arial';ctx.textAlign='center';ctx.fillText('DFL',126,137);ctx.textAlign='left';
    ctx.fillStyle='#f4f4f5';ctx.font='900 45px Arial';ctx.fillText('ACERTO DO MOTOBOY',190,125);ctx.fillStyle='#a1a1aa';ctx.font='600 28px Arial';ctx.fillText(motoboy.name,190,170);ctx.fillStyle='#6ee7b7';ctx.font='700 25px Arial';ctx.fillText(fromKey(date).toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}),190,210);
    round(64,286,952,156,34,'rgba(14,165,233,.07)','#173947');const stat=(x:number,label:string,value:string)=>{ctx.fillStyle='#71717a';ctx.font='700 22px Arial';ctx.fillText(label.toUpperCase(),x,337);ctx.fillStyle='#f4f4f5';ctx.font='900 38px Arial';ctx.fillText(value,x,392);};stat(100,'Paradas físicas',String(data.physicalDeliveryCount));stat(405,'Pedidos',String(data.orderCount));stat(700,'Vendas em dinheiro',`R$ ${money(data.cashCollected)}`);
    round(64,474,952,720,34,'rgba(24,24,27,.9)','#27272a');ctx.fillStyle='#d4d4d8';ctx.font='900 25px Arial';ctx.fillText('RESUMO FINANCEIRO',100,526);
    let y=590;
    const row=(label:string,value:string,tone='#f4f4f5')=>{ctx.fillStyle='#8b8b94';ctx.font='600 27px Arial';ctx.fillText(label,100,y);ctx.fillStyle=tone;ctx.font='800 30px Arial';ctx.textAlign='right';ctx.fillText(value,980,y);ctx.textAlign='left';ctx.strokeStyle='#242429';ctx.beginPath();ctx.moveTo(100,y+25);ctx.lineTo(980,y+25);ctx.stroke();y+=72;};
    const detail=(label:string,value:string)=>{ctx.fillStyle='#71717a';ctx.font='600 22px Arial';ctx.fillText(`↳ ${label}`,120,y);ctx.fillStyle='#a1a1aa';ctx.font='700 23px Arial';ctx.textAlign='right';ctx.fillText(value,980,y);ctx.textAlign='left';y+=48;};
    row('Acerto bruto',`R$ ${money(data.fee.amount)}`);
    if(data.totalVales>0){
      row('Abatimentos',`- R$ ${money(data.totalVales)}`,'#fb7185');
      adjustments.filter(item=>item.direction!=='addition').slice(0,2).forEach(item=>detail(`${adjustmentKindLabel(item.kind)} · ${item.category_label||item.description.slice(0,25)}`,`R$ ${money(item.amount)}`));
    }
    if(data.totalAdditions>0){
      row('Acréscimos',`+ R$ ${money(data.totalAdditions)}`,'#34d399');
      adjustments.filter(item=>item.direction==='addition').slice(0,2).forEach(item=>detail(`${adjustmentKindLabel(item.kind)} · ${item.category_label||item.description.slice(0,25)}`,`R$ ${money(item.amount)}`));
    }
    row('Clientes entregaram',`R$ ${money(data.cashInHand)}`,'#fbbf24');
    row('Troco da loja',`- R$ ${money(data.cashChange)}`,'#fb7185');
    row('Vendas líquidas',`R$ ${money(data.cashCollected)}`,'#a1a1aa');
    row('Líquido do motoboy',`R$ ${money(data.liquidFee)}`,'#34d399');

    const resultColor=data.settlementDirection==='store_credit'?'#f59e0b':'#10b981';
    round(64,1260,952,246,38,resultColor);
    ctx.fillStyle='#052e22';ctx.font='900 24px Arial';ctx.fillText('RESULTADO DO ACERTO',104,1315);
    ctx.font='900 54px Arial';ctx.fillText(`R$ ${money(data.balance)}`,104,1384);
    ctx.font='900 25px Arial';ctx.fillText(settlementTitle.slice(0,48),104,1430);
    ctx.font='700 22px Arial';ctx.fillText(settlementExplanation.slice(0,70),104,1472);

    ctx.fillStyle='#71717a';ctx.font='600 21px Arial';ctx.fillText(cashHandedOver?'Caixa das entregas conferido na loja':'Dinheiro considerado no acerto com o motoboy',72,1624);ctx.textAlign='right';ctx.fillText('Gerado pelo DFL Entregas',1008,1624);ctx.textAlign='left';
    const dataUrl=canvas.toDataURL('image/png',1);const filename=`acerto-${motoboy.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}-${date}.png`;
    if(Capacitor.isNativePlatform()){const saved=await Filesystem.writeFile({path:`dfl-acertos/${filename}`,data:dataUrl.split(',')[1],directory:Directory.Cache,recursive:true});await Share.share({title:`Acerto · ${motoboy.name}`,text:summary(),files:[saved.uri],dialogTitle:'Compartilhar comprovante'});toast.success('Imagem gerada. Escolha onde compartilhar.');return;}
    const blob=await (await fetch(dataUrl)).blob();const file=new File([blob],filename,{type:'image/png'});if(navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({title:`Acerto · ${motoboy.name}`,files:[file]});return;}const link=document.createElement('a');link.download=filename;link.href=dataUrl;link.click();toast.success('Imagem baixada.');
    }catch(error){if(error instanceof Error&&/cancel/i.test(error.message))return;console.error('[ACERTO] Falha ao gerar imagem:',error);toast.error('Não foi possível gerar ou compartilhar a imagem.');}finally{setImageBusy(false);}
  };

  return <div className="flex flex-col gap-5 pb-28">
    <PageHeader title="Acerto do motoboy" subtitle={motoboy.name} to={`/motoboys/details?id=${motoboy.id}`}/>
    <div className="flex items-center gap-2 rounded-[22px] border border-zinc-800 bg-zinc-900/45 p-2"><button onClick={()=>setDate(value=>shift(value,-1))} className="date-button"><ChevronLeft/></button><button onClick={()=>{setMonth(fromKey(date));setCalendar(true)}} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-zinc-800 text-sm font-black"><CalendarDays size={17} className="text-emerald-400"/>{fromKey(date).toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'short'}).replaceAll('.','')}</button><button onClick={()=>setDate(value=>shift(value,1))} className="date-button"><ChevronRight/></button></div>

    {existing&&<section className="rounded-[22px] border border-emerald-500/20 bg-emerald-500/[.05] p-4"><p className="text-[9px] font-black uppercase tracking-[.15em] text-emerald-400">{typeof existing.settlement_gross_amount==='number'?'Acerto registrado':'Acerto registrado · legado'}</p><p className="mt-2 text-xl font-black text-emerald-300">R$ {money(existing.settlement_gross_amount ?? existing.amount)}</p><p className="mt-1 text-[10px] text-zinc-500">{typeof existing.settlement_gross_amount==='number'?'Custo operacional bruto do motoboy. O dinheiro recebido de clientes fica separado como liquidação de caixa.':'Valor originalmente registrado. Este acerto é anterior à separação entre custo bruto, abatimentos e caixa; o histórico não foi recalculado automaticamente.'}</p></section>}

    <div className="grid grid-cols-2 gap-3"><Card icon={Package} label={data.orderCount===data.physicalDeliveryCount?"Entregas concluídas":`${data.orderCount} pedidos`} value={String(data.physicalDeliveryCount)} tone="sky"/><Card icon={Banknote} label="Recebido · antes do troco" value={`R$ ${money(data.cashTendered)}`} tone="amber"/></div>

    {(data.priorStoreCredit>0||data.priorMotoboyCredit>0)&&<section className="rounded-[22px] border border-amber-500/20 bg-amber-500/[.055] p-4"><p className="text-[9px] font-black uppercase tracking-[.15em] text-amber-400">Saldo trazido do acerto anterior</p><p className="mt-2 text-lg font-black text-amber-200">R$ {money(data.priorStoreCredit||data.priorMotoboyCredit)}</p><p className="mt-1 text-[10px] leading-relaxed text-zinc-500">{data.priorStoreCredit>0?`${motoboy.name} estava com este valor da loja. Ele será compensado automaticamente hoje.`:`A loja devia este valor a ${motoboy.name}. Ele será somado automaticamente ao acerto de hoje.`}</p></section>}

    <section className="rounded-[24px] border border-sky-500/20 bg-sky-500/5 p-5"><p className="text-[10px] font-black uppercase tracking-wider text-sky-400">Prévia do acerto</p><div className="mt-4 space-y-3"><Line label="Acerto bruto" value={`R$ ${money(data.fee.amount)}`}/><p className="text-[10px] text-zinc-500">{data.fee.description}</p>{adjustments.map(item=><div key={item.id} className="flex items-center gap-2"><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-zinc-300">{item.description}</p><p className="text-[9px] text-zinc-600">{adjustmentKindLabel(item.kind)} · {item.direction==='addition'?'acréscimo':'abatimento'}</p></div><span className={`text-xs font-black ${item.direction==='addition'?'text-emerald-400':'text-red-400'}`}>{item.direction==='addition'?'+':'-'} R$ {money(item.amount)}</span><button onClick={()=>setAdjustments(current=>current.filter(value=>value.id!==item.id))} className="grid h-8 w-8 place-items-center rounded-xl text-red-500"><Trash2 size={13}/></button></div>)}<div className="border-t border-sky-500/10 pt-3"><Line label="Total dos abatimentos" value={`- R$ ${money(data.totalVales)}`}/><Line label="Total dos acréscimos" value={`+ R$ ${money(data.totalAdditions)}`}/><Line label="Líquido do motoboy" value={`R$ ${money(data.liquidFee)}`} strong/></div></div></section>

    <section className="rounded-[24px] border border-zinc-800 bg-zinc-900/35 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Ajuste do acerto</p><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={()=>{setAdjustmentDirection('deduction');setAdjustmentCategoryId('advance');setAdjustmentKind('advance')}} className={`h-11 rounded-xl border text-xs font-black ${adjustmentDirection==='deduction'?'border-red-500/35 bg-red-500/10 text-red-300':'border-zinc-800 text-zinc-500'}`}>− Abatimento</button><button onClick={()=>{setAdjustmentDirection('addition');setAdjustmentCategoryId('tip');setAdjustmentKind('tip')}} className={`h-11 rounded-xl border text-xs font-black ${adjustmentDirection==='addition'?'border-emerald-500/35 bg-emerald-500/10 text-emerald-300':'border-zinc-800 text-zinc-500'}`}>+ Acréscimo</button></div><div className="mt-3 grid grid-cols-2 gap-2">{directionCategories.map(category=><button key={category.id} onClick={()=>{setAdjustmentCategoryId(category.id);setAdjustmentKind(category.custom?'custom':category.id as MotoboySettlementAdjustment['kind'])}} className={`min-h-12 rounded-xl border px-3 text-[11px] font-black ${selectedCategory?.id===category.id?'border-amber-500/40 bg-amber-500/10 text-amber-200':'border-zinc-800 text-zinc-500'}`}>{category.label}</button>)}<button onClick={()=>setCategoryManager(true)} className="min-h-12 rounded-xl border border-dashed border-sky-500/35 bg-sky-500/5 px-3 text-[11px] font-black text-sky-300"><Plus size={14} className="mx-auto mb-1"/>Nova categoria</button></div><div className="mt-3 grid grid-cols-[1fr_112px_48px] gap-2"><input value={adjustmentDescription} onChange={e=>setAdjustmentDescription(e.target.value)} placeholder="Observação opcional" className="input"/><input value={adjustmentValue} onChange={e=>setAdjustmentValue(normalizeMoneyDraft(e.target.value))} inputMode="numeric" placeholder="0,00" className="input text-right font-black"/><button onClick={addAdjustment} aria-label="Adicionar ajuste" className="flex h-12 items-center justify-center rounded-xl bg-amber-400 text-zinc-950"><Plus size={18}/></button></div></section>

    <section className="rounded-[24px] border border-zinc-800 bg-zinc-900/45 p-4"><p className="text-sm font-black">Como fechar o caixa?</p><p className="mt-1 text-[10px] leading-relaxed text-zinc-500">Clientes entregaram R$ {money(data.cashInHand)}. Tirando R$ {money(data.cashChange)} de troco bancado pela loja, as vendas líquidas são R$ {money(data.cashCollected)}.</p><div className="mt-3 grid gap-2"><button onClick={()=>setSettlementStrategy('separate')} className={`rounded-2xl border p-3 text-left ${settlementStrategy==='separate'?'border-emerald-500/40 bg-emerald-500/10':'border-zinc-800'}`}><span className="block text-xs font-black">Caixa separado</span><span className="mt-1 block text-[9px] text-zinc-500">Devolve R$ {money(data.cashInHand)} e a diária é paga à parte.</span></button><button onClick={()=>setSettlementStrategy('offset')} className={`rounded-2xl border p-3 text-left ${settlementStrategy==='offset'?'border-sky-500/40 bg-sky-500/10':'border-zinc-800'}`}><span className="block text-xs font-black">Compensar diária nas vendas</span><span className="mt-1 block text-[9px] text-zinc-500">Retém no máximo R$ {money(data.cashCollected)} das vendas; dinheiro do troco nunca entra na diária.</span></button><button onClick={()=>setSettlementStrategy('manual')} className={`rounded-2xl border p-3 text-left ${settlementStrategy==='manual'?'border-amber-500/40 bg-amber-500/10':'border-zinc-800'}`}><span className="block text-xs font-black">Conferência manual</span><span className="mt-1 block text-[9px] text-zinc-500">Use somente quando o valor físico devolvido for diferente.</span></button></div>{settlementStrategy==='manual'&&<><div className="mt-3 grid grid-cols-3 gap-2">{([['all','Tudo'],['partial','Informar'],['none','Nada']] as const).map(([value,label])=><button key={value} onClick={()=>{setCashMode(value);if(value==='partial'&&!cashHandedDraft)setCashHandedDraft(moneyValueToDraft(data.cashInHand))}} className={`min-h-11 rounded-xl border px-2 text-[10px] font-black ${cashMode===value?'border-amber-500/35 bg-amber-500/10 text-amber-200':'border-zinc-800 text-zinc-600'}`}>{label}</button>)}</div>{cashMode==='partial'&&<label className="mt-3 block text-[10px] font-bold text-zinc-500">Quanto voltou fisicamente para a loja?<input value={cashHandedDraft} onChange={e=>setCashHandedDraft(normalizeMoneyDraft(e.target.value))} inputMode="numeric" className="input mt-2 w-full text-right text-sm font-black text-zinc-100" placeholder="0,00"/></label>}</>}<div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-zinc-950/60 p-3"><Line label="Voltou para a loja" value={`R$ ${money(data.cashHandedOverAmount)}`}/><Line label="Retido pelo motoboy" value={`R$ ${money(data.retainedCash)}`}/></div><p className="mt-2 text-[10px] font-bold leading-relaxed text-sky-300">{settlementEquation}</p><p className="mt-2 text-[9px] leading-relaxed text-zinc-600">Pix enviado ao motoboy deve ser lançado como Adiantamento.</p></section>

    <section className={`rounded-[26px] p-5 ${data.settlementDirection==='store_credit'?'bg-amber-500':'bg-emerald-500'}`}><div className="flex items-center justify-between text-zinc-950"><p className="text-[10px] font-black uppercase tracking-wider">Resultado do acerto</p>{data.settlementDirection==='store_credit'?<ArrowDownLeft/>:<ArrowUpRight/>}</div><p className="mt-1 break-words text-[clamp(1.65rem,8vw,2.25rem)] font-black tabular-nums text-zinc-950">R$ {money(data.balance)}</p><p className="mt-1 text-xs font-black uppercase text-zinc-900">{settlementTitle}</p><p className="mt-2 max-w-[32rem] text-[11px] font-bold leading-relaxed text-zinc-900/80">{settlementExplanation}</p></section>

    <button disabled={saving||Boolean(existing)} onClick={confirm} className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-sm font-black text-zinc-950 disabled:opacity-40"><ReceiptText size={17}/>{existing?'Acerto já registrado':saving?'Confirmando...':'Confirmar acerto'}</button>
    <div className="grid grid-cols-3 gap-2"><button onClick={copy} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-zinc-800 text-[10px] font-black text-zinc-300"><Copy size={14}/>Copiar</button><button onClick={share} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-zinc-800 text-[10px] font-black text-zinc-300"><Send size={14}/>Compartilhar</button><button disabled={imageBusy} onClick={()=>void image()} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-zinc-800 text-[10px] font-black text-zinc-300 disabled:opacity-40"><ImageIcon size={14}/>{imageBusy?'Gerando...':'Imagem'}</button></div>

    {categoryManager&&<div className="fixed inset-0 z-[60] flex items-end bg-black/80 p-3 backdrop-blur-sm" onClick={()=>setCategoryManager(false)}><div className="w-full rounded-[28px] border border-zinc-800 bg-zinc-950 p-5" onClick={event=>event.stopPropagation()}><div className="flex items-start justify-between"><div><p className="text-lg font-black">Nova categoria</p><p className="mt-1 text-[10px] text-zinc-500">Será salva no Firebase e aparecerá em todos os aparelhos.</p></div><button onClick={()=>setCategoryManager(false)} className="date-button"><X size={17}/></button></div><div className="mt-4 flex gap-2"><input autoFocus value={newCategoryName} onChange={e=>setNewCategoryName(e.target.value)} maxLength={32} placeholder={adjustmentDirection==='deduction'?'Ex.: Uniforme':'Ex.: Prêmio'} className="input flex-1"/><button disabled={savingCategory} onClick={()=>void saveCustomCategory()} className="rounded-xl bg-emerald-500 px-4 text-xs font-black text-zinc-950 disabled:opacity-50">{savingCategory?'Salvando...':'Salvar'}</button></div>{customCategories.filter(item=>item.direction===adjustmentDirection).length>0&&<div className="mt-5 border-t border-zinc-800 pt-4"><p className="mb-2 text-[10px] font-black uppercase tracking-wider text-zinc-600">Ordem das categorias personalizadas</p>{customCategories.filter(item=>item.direction===adjustmentDirection).map((item,index,array)=><div key={item.id} className="mb-2 flex items-center gap-2 rounded-xl bg-zinc-900 p-2 pl-3"><span className="min-w-0 flex-1 truncate text-xs font-bold">{item.label}</span><button disabled={index===0} onClick={()=>void moveCustomCategory(item.id,-1)} className="date-button disabled:opacity-20"><ArrowUp size={14}/></button><button disabled={index===array.length-1} onClick={()=>void moveCustomCategory(item.id,1)} className="date-button disabled:opacity-20"><ArrowDown size={14}/></button></div>)}</div>}</div></div>}

    {calendar&&<div className="fixed inset-0 z-50 flex items-end bg-black/75 p-3 backdrop-blur-sm" onClick={()=>setCalendar(false)}><div className="w-full rounded-[30px] border border-zinc-800 bg-zinc-950 p-5" onClick={e=>e.stopPropagation()}><div className="mb-4 flex items-center justify-between"><button onClick={()=>setMonth(value=>new Date(value.getFullYear(),value.getMonth()-1,1))} className="date-button"><ChevronLeft/></button><p className="font-black capitalize">{month.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</p><button onClick={()=>setMonth(value=>new Date(value.getFullYear(),value.getMonth()+1,1))} className="date-button"><ChevronRight/></button></div><div className="grid grid-cols-7 text-center text-[10px] text-zinc-600">{['D','S','T','Q','Q','S','S'].map((label,index)=><span key={`${label}-${index}`}>{label}</span>)}</div><div className="mt-2 grid grid-cols-7 gap-1">{days.map(day=>{const key=operationalDateKey(day);return <button key={key} onClick={()=>{setDate(key);setCalendar(false)}} className={`aspect-square rounded-xl text-xs font-bold ${key===date?'bg-emerald-500 text-zinc-950':day.getMonth()===month.getMonth()?'text-zinc-300':'text-zinc-700'}`}>{day.getDate()}</button>})}</div><button onClick={()=>setCalendar(false)} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 text-xs font-bold text-zinc-400"><X size={15}/>Fechar</button></div></div>}

    <style jsx>{`.date-button{display:flex;height:2.75rem;width:2.75rem;align-items:center;justify-content:center;border-radius:1rem;color:rgb(113 113 122)}.input{height:3rem;min-width:0;border-radius:.75rem;border:1px solid rgb(39 39 42);background:rgb(24 24 27/.6);padding:0 .75rem;font-size:.75rem;outline:none}`}</style>
  </div>
}

function Line({label,value,strong=false}:{label:string;value:string;strong?:boolean}){return <div className="flex items-center justify-between gap-3"><span className={`text-xs ${strong?'font-black text-zinc-200':'text-zinc-500'}`}>{label}</span><span className={`${strong?'text-lg text-emerald-300':'text-sm text-zinc-300'} font-black`}>{value}</span></div>}
function Card({icon:Icon,label,value,tone}:{icon:typeof Package;label:string;value:string;tone:'sky'|'amber'}){return <div className={`rounded-[22px] border p-4 ${tone==='sky'?'border-sky-500/20 bg-sky-500/5':'border-amber-500/20 bg-amber-500/5'}`}><Icon size={16} className={tone==='sky'?'text-sky-400':'text-amber-400'}/><p className="mt-3 text-xl font-black">{value}</p><p className="text-[10px] text-zinc-500">{label}</p></div>}
export default function MotoboySettlementPage(){return <Suspense fallback={<p className="py-20 text-center text-zinc-500">Carregando...</p>}><Content/></Suspense>}
