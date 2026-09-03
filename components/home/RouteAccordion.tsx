'use client';

import { useState } from 'react';
import { 
  ChevronDown, Bike, Wallet, CheckCircle2, RotateCcw, Timer, MapPin, 
  Copy, User, UserRound, AlertTriangle, X, Trash2, Receipt, MessageCircle, Send
} from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import type { Route } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { DeliveryCard } from '@/components/home/DeliveryCard';
import { useOptimizedDeliveries } from '@/hooks/useOptimizedDeliveries';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { generateRouteMessages, generateClientDispatchUrl } from '@/lib/whatsapp';
import { resolveStopLocation, buildGoogleMapsRouteUrl } from '@/lib/maps';

interface RouteAccordionProps {
  route: Route;
  defaultOpen?: boolean;
}

export function RouteAccordion({ route, defaultOpen = false }: RouteAccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [fuzzyModalOpen, setFuzzyModalOpen] = useState(false);
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false); 
  const [isCopyMenuOpen, setIsCopyMenuOpen] = useState(false);
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [currentFuzzyList, setCurrentFuzzyList] = useState<any[]>([]);
  const [pendingActionType, setPendingActionType] = useState<'copy1' | 'copy2' | 'maps' | null>(null);

  const getDeliveriesByRoute = useAppStore((state) => state.getDeliveriesByRoute);
  const getCustomerById = useAppStore((state) => state.getCustomerById);
  const closeRoute = useAppStore((state) => state.closeRoute);
  const reopenRoute = useAppStore((state) => state.reopenRoute);
  const startRoute = useAppStore((state) => state.startRoute); 
  const deleteRoute = useAppStore((state) => state.deleteRoute); 
  const isPrivacyMode = useAppStore((state) => state.isPrivacyMode);
  const allRoutes = useAppStore((state) => state.routes);
  
  const routeAlertsEnabled = useAppStore((state) => state.routeAlertsEnabled);
  const storeSettings = useAppStore((state) => state.storeSettings);
  const motoboys = useAppStore((state) => state.motoboys);

  const deliveries = getDeliveriesByRoute(route.id);
  const totalDeliveries = deliveries.length;
  const pendingDeliveriesCount = deliveries.filter((d) => !d.completed).length;
  const progressPercent = totalDeliveries > 0 ? ((totalDeliveries - pendingDeliveriesCount) / totalDeliveries) * 100 : 0;
  
  const routeTotalValue = deliveries.reduce((acc, curr) => acc + (curr.value || 0), 0);

  const isNotStarted = route.status === 'aberta' && !route.started_at;
  const isInProgress = route.status === 'aberta' && !!route.started_at;
  const isCompleted = route.status === 'fechada';

  const motoboyObj = motoboys.find((m) => m.name === route.motoboy_name);
  const MotoIcon = motoboyObj?.avatar?.includes('woman') ? UserRound : motoboyObj?.avatar?.includes('bike') ? Bike : User;

  const { sortedDeliveries, pendingDeliveries, neighborhoodCounts } = useOptimizedDeliveries(deliveries, getCustomerById);

  // Clientes com telefone para disparo de aviso de saída
  const clientsWithPhone = deliveries
    .map((d) => {
      const cust = getCustomerById(d.customer_id);
      const phone = d.phone || cust?.phone;
      return {
        id: d.id,
        name: cust?.name || 'Cliente',
        phone,
        orderId: d.order_id
      };
    })
    .filter((c) => !!c.phone);

  let routeDuration = '';
  if (isCompleted && route.started_at && route.end_time) {
    const start = new Date(route.started_at).getTime();
    const end = new Date(route.end_time).getTime();
    const diffMins = Math.floor((end - start) / 60000);
    if (diffMins >= 0) {
      const hrs = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      routeDuration = hrs > 0 ? `${hrs}h${mins}m` : `${mins}min`;
    }
  }

  const getPreviousRoute = (): Route | null => {
    if (!allRoutes || allRoutes.length === 0) return null;
    const motoboyRoutes = allRoutes
      .filter((r) => r.motoboy_name === route.motoboy_name)
      .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
    
    const currentIndex = motoboyRoutes.findIndex((r) => r.id === route.id);
    return currentIndex > 0 ? motoboyRoutes[currentIndex - 1] : null;
  };

  const handleStartRoute = async () => {
    startRoute(route.id);
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light });
    toast.success('Rota Iniciada! 🚀', { description: 'O cronômetro de performance está valendo.' });
  };

  const handleCloseRoute = async () => {
    if (Capacitor.isNativePlatform()) await Haptics.notification({ type: NotificationType.Success });
    closeRoute(route.id);
    toast.success('Rota finalizada!', { description: 'Enviada para as rotas concluídas.' });
    setIsOpen(false);

    if (routeAlertsEnabled && Capacitor.isNativePlatform()) {
      LocalNotifications.schedule({
        notifications: [{
          title: '🎉 Rota Finalizada!',
          body: `O motoboy ${route.motoboy_name} encerrou a rota.`,
          id: Math.floor(Math.random() * 100000), 
          schedule: { at: new Date(Date.now() + 1000) }, 
        }]
      });
    }
  };

  const handleDeleteEmptyRoute = async () => {
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Heavy });
    await deleteRoute(route.id);
    toast.success('Rota excluída com sucesso!');
  };

  const confirmReopenRoute = async () => {
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Medium });
    await reopenRoute(route.id);
    setIsReopenModalOpen(false);
    toast.success('Rota reaberta para correções!');
  };

  const handleCopyMessage = async (msgType: 1 | 2) => {
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light });
    const storeAddr = storeSettings?.storeAddress || 'Patos de Minas, MG';
    const previousRoute = getPreviousRoute();
    
    const result = await generateRouteMessages(route, pendingDeliveries, storeAddr, getCustomerById, previousRoute);
    
    if (result.hasFuzzyAddresses && result.fuzzyList.length > 0 && msgType === 1) {
      setCurrentFuzzyList(result.fuzzyList);
      setPendingActionType(msgType === 1 ? 'copy1' : 'copy2');
      setFuzzyModalOpen(true);
      return;
    }

    executeCopyAction(msgType, result.messages);
  };

  const executeCopyAction = async (msgType: 1 | 2, messages?: string[]) => {
    setFuzzyModalOpen(false);
    const storeAddr = storeSettings?.storeAddress || 'Patos de Minas, MG';
    const previousRoute = getPreviousRoute();
    
    const msgsToCopy = messages || (await generateRouteMessages(route, pendingDeliveries, storeAddr, getCustomerById, previousRoute)).messages;

    if (msgType === 1) {
      await navigator.clipboard.writeText(msgsToCopy[0]);
      toast.success('Mensagem 1 copiada!', { description: 'Rota e mapas prontos para o WhatsApp.' });
    } else {
      await navigator.clipboard.writeText(msgsToCopy[1]);
      toast.success('Mensagem 2 copiada!', { description: 'Resumo, bebidas e valor exato a passar pro caixa prontos.' });
    }
    setIsCopyMenuOpen(false);
  };

  const handleOpenMaps = async () => {
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light });
    
    const stops = pendingDeliveries.map((d) => {
      const cust = getCustomerById(d.customer_id);
      return resolveStopLocation(d, cust?.maps_link);
    });

    if (stops.length === 0) return;

    const storeAddr = storeSettings?.storeAddress || 'Patos de Minas, MG';
    const mapUrl = buildGoogleMapsRouteUrl(storeAddr, stops);

    window.open(mapUrl, '_blank');
  };

  return (
    <div className={clsx("overflow-hidden rounded-[28px] border transition-all duration-300 relative", isNotStarted ? "bg-zinc-900/60 border-zinc-700/80" : isInProgress ? "bg-sky-900/10 border-sky-500/30" : "bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.05)]")}>
      {totalDeliveries > 0 && !isCompleted && (
        <div className="absolute top-0 left-0 h-1 bg-zinc-800 w-full">
          <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${progressPercent}%` }} />
        </div>
      )}
      <button onClick={() => setIsOpen((prev) => !prev)} className="flex w-full items-center justify-between gap-3 p-4 pt-5 active:scale-[0.99] transition-transform">
        <div className="flex items-center gap-3">
          <div className={clsx('flex h-12 w-12 items-center justify-center rounded-full transition-colors shrink-0', isNotStarted ? 'bg-zinc-800 text-zinc-400' : isInProgress ? 'bg-sky-500/20 text-sky-400' : 'bg-emerald-500/20 text-emerald-500')}>
            <Bike size={22} />
          </div>
          <div className="text-left flex flex-col">
            <div className="flex items-center gap-2">
              <p className={clsx("font-heading text-lg font-bold truncate max-w-[130px]", isCompleted ? "text-emerald-400" : "text-zinc-50")}>{route.name}</p>
              {isNotStarted && <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-[9px] font-bold uppercase text-zinc-300">Montando</span>}
              {isInProgress && <span className="rounded-full bg-sky-500 px-2 py-0.5 text-[9px] font-bold uppercase text-white shadow-sm shadow-sky-500/30">Na Rua</span>}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 text-xs font-semibold text-zinc-400">
              <MotoIcon size={12} className={isInProgress ? 'text-sky-400' : isCompleted ? 'text-emerald-500' : 'text-zinc-500'} />
              <span className="truncate max-w-[120px]">{route.motoboy_name}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!isCompleted ? (
            <span className={clsx("rounded-full px-2.5 py-1 text-xs font-bold", pendingDeliveriesCount === 0 && totalDeliveries > 0 ? "bg-emerald-500 text-white" : isInProgress ? "bg-sky-500/20 text-sky-400" : "bg-zinc-800 text-zinc-400")}>
              {pendingDeliveriesCount === 0 && totalDeliveries > 0 ? 'Concluída!' : `${pendingDeliveriesCount} pendente${pendingDeliveriesCount !== 1 ? 's' : ''}`}
            </span>
          ) : (
            <div className="flex items-center gap-2">
              {routeDuration && (
                <div className="flex items-center gap-1 bg-zinc-800/80 border border-zinc-700/50 px-2.5 py-1 rounded-full">
                  <Timer size={12} className="text-zinc-400" />
                  <span className="text-zinc-300 font-bold text-[10px]">{routeDuration}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                <CheckCircle2 size={14} className="text-emerald-400" />
                <span className="text-emerald-400 font-bold text-[11px]">
                  {isPrivacyMode ? 'R$ •••••' : `R$ ${routeTotalValue.toFixed(2).replace('.', ',')}`}
                </span>
              </div>
            </div>
          )}
          <ChevronDown size={18} className={clsx('text-zinc-500 transition-transform duration-200 ml-1', isOpen && 'rotate-180')} />
        </div>
      </button>

      {isOpen && (
        <div className="flex flex-col gap-3 border-t border-zinc-800/80 p-4 pt-3 pb-6">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {route.change_money > 0 && (
              <span className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-500">
                <Wallet size={13} /> Levar Troco: {isPrivacyMode ? 'R$ •••••' : `R$ ${route.change_money.toFixed(2).replace('.', ',')}`}
              </span>
            )}

            {clientsWithPhone.length > 0 && (
              <button 
                onClick={() => setIsDispatchModalOpen(true)}
                className="flex items-center gap-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold active:scale-95 transition-all shadow-sm"
              >
                <Send size={12} /> Avisar Clientes ({clientsWithPhone.length})
              </button>
            )}
          </div>

          {sortedDeliveries.length === 0 ? (
            <p className="py-4 text-center text-sm text-zinc-600">Nenhuma entrega nesta rota ainda.</p>
          ) : (
            sortedDeliveries.map((delivery) => {
              const cust = getCustomerById(delivery.customer_id);
              const neighborhoodKey = cust?.neighborhood?.trim().toLowerCase();
              const isNeighbor = neighborhoodKey ? (neighborhoodCounts[neighborhoodKey] > 1) : false;
              return (
                <DeliveryCard key={delivery.id} delivery={delivery} customer={cust} route={route} isNeighbor={isNeighbor} />
              );
            })
          )}
          
          <div className="mt-2 flex flex-col gap-2">
            {sortedDeliveries.length === 0 && isNotStarted && (
              <button onClick={handleDeleteEmptyRoute} className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-red-500/10 border border-red-500/20 py-3.5 text-sm font-bold text-red-500 hover:bg-red-500/20 active:scale-95 transition-all">
                <Trash2 size={18} /> Excluir Rota Vazia
              </button>
            )}
            {sortedDeliveries.length > 0 && route.status === 'aberta' && (
              <div className="fixed bottom-24 left-0 right-0 z-40 mx-auto flex w-full max-w-[92%] items-center justify-between gap-3 rounded-[24px] border border-zinc-700/80 bg-zinc-900/95 px-4 py-3 backdrop-blur-xl shadow-2xl shadow-black/50">
                <button onClick={() => setIsCopyMenuOpen(true)} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-zinc-800/80 text-sm font-semibold text-zinc-300 active:scale-95">
                  <Copy size={18} className="text-emerald-500" />
                  <span className="truncate">Copiar (WhatsApp)</span>
                </button>
                <button onClick={handleOpenMaps} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 active:scale-95">
                  <MapPin size={18} />
                  <span className="truncate">Otimizar (Maps)</span>
                </button>
              </div>
            )}
            {route.status === 'aberta' && totalDeliveries > 0 ? (
              !route.started_at ? (
                <button onClick={handleStartRoute} className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-sky-500/10 border border-sky-500/20 py-3.5 text-sm font-bold text-sky-500 hover:bg-sky-500/20 active:scale-95">
                  <Timer size={18} /> Iniciar Rota (Cronômetro)
                </button>
              ) : (
                <button onClick={handleCloseRoute} className={clsx("flex w-full items-center justify-center gap-2 rounded-[20px] py-3.5 text-sm font-bold active:scale-95 transition-all", pendingDeliveriesCount === 0 && totalDeliveries > 0 ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 animate-pulse" : "bg-zinc-800/80 text-zinc-300")}>
                  <CheckCircle2 size={18} className={pendingDeliveriesCount === 0 ? "text-white" : "text-emerald-500"} />
                  {pendingDeliveriesCount === 0 ? 'Tudo Entregue! Fechar Rota' : 'Finalizar Rota'}
                </button>
              )
            ) : null}
            {route.status === 'fechada' && (
              <button onClick={() => setIsReopenModalOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-zinc-800/40 border border-zinc-700/50 py-3.5 text-sm font-semibold text-zinc-400 hover:bg-zinc-800 active:scale-95 mt-2">
                <RotateCcw size={16} /> Reabrir Rota (Correções)
              </button>
            )}
          </div>
        </div>
      )}

      {/* MODAL BOTTOM SHEET DE CÓPIA DO WHATSAPP */}
      {isCopyMenuOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/80 animate-in fade-in">
          <div className="bg-[#1a1a1a] rounded-t-[32px] p-6 pb-10 flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom duration-300 relative">
             <div className="mx-auto mb-6 h-1.5 w-12 rounded-full bg-zinc-700" />
             <div className="flex items-center justify-between mb-6">
               <h3 className="font-bold text-xl text-zinc-50 flex items-center gap-2"><Copy size={20} className="text-emerald-500"/> Enviar para WhatsApp</h3>
               <button onClick={() => setIsCopyMenuOpen(false)} className="p-2.5 bg-zinc-800 rounded-full text-zinc-400 active:scale-90"><X size={20}/></button>
             </div>

             <div className="flex flex-col gap-4">
                <button onClick={() => handleCopyMessage(1)} className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 p-5 rounded-3xl active:scale-95 transition-all text-left">
                  <div className="h-14 w-14 rounded-full bg-sky-500/10 text-sky-400 flex items-center justify-center shrink-0"><MapPin size={24}/></div>
                  <div className="flex flex-col">
                    <span className="font-black text-zinc-100 text-lg">Mensagem 1 (Logística)</span>
                    <span className="text-xs text-zinc-400 font-medium mt-1 leading-relaxed">Copia os endereços, IDs, botão de chamar no portão e o link do Mapa otimizado.</span>
                  </div>
                </button>
                
                <button onClick={() => handleCopyMessage(2)} className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 p-5 rounded-3xl active:scale-95 transition-all text-left">
                  <div className="h-14 w-14 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0"><Receipt size={24}/></div>
                  <div className="flex flex-col">
                    <span className="font-black text-zinc-100 text-lg">Mensagem 2 (Acerto)</span>
                    <span className="text-xs text-zinc-400 font-medium mt-1 leading-relaxed">Bebidas, aviso de maquininha e o valor bruto real a recolher no caixa.</span>
                  </div>
                </button>
             </div>
          </div>
        </div>
      )}

      {/* MODAL PARA O BALCÃO AVISAR CLIENTES DA SAÍDA */}
      {isDispatchModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400">
                <MessageCircle size={22} />
                <h3 className="text-base font-bold text-zinc-50">Avisar Saída do Pedido</h3>
              </div>
              <button onClick={() => setIsDispatchModalOpen(false)} className="text-zinc-500 hover:text-zinc-300"><X size={20}/></button>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">Toque no cliente para abrir a conversa no WhatsApp avisando que o motoboy <strong className="text-zinc-200">{route.motoboy_name}</strong> saiu com a entrega:</p>
            
            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
              {clientsWithPhone.map((c) => (
                <a
                  key={c.id}
                  href={generateClientDispatchUrl(c.name, c.phone!, route.motoboy_name)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between p-3 rounded-2xl bg-zinc-950 border border-zinc-800 hover:border-emerald-500/40 active:scale-95 transition-all"
                >
                  <div className="flex flex-col truncate pr-2">
                    <span className="text-xs font-bold text-zinc-200 truncate">{c.name} {c.orderId && `(#${c.orderId})`}</span>
                    <span className="text-[10px] text-zinc-500">{c.phone}</span>
                  </div>
                  <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-xl shrink-0">
                    Avisar <Send size={10} />
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE REABERTURA */}
      {isReopenModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-amber-500">
                <AlertTriangle size={24} />
                <h3 className="text-lg font-bold text-zinc-50">Atenção ao Reabrir</h3>
              </div>
              <button onClick={() => setIsReopenModalOpen(false)} className="text-zinc-500 hover:text-zinc-300"><X size={20}/></button>
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl">
              Se você precisa <strong className="text-amber-400">apenas consultar</strong> dados, não é necessário reabrir. As entregas já estão visíveis acima.
            </p>
            <p className="text-xs text-zinc-400 leading-relaxed px-1">Reabrir a rota reiniciará o status para aberta e permitirá edições. O tempo original de entrega da rota está seguro.</p>
            <div className="flex flex-col gap-2.5 pt-3">
              <button onClick={confirmReopenRoute} className="w-full h-12 bg-amber-500 hover:bg-amber-400 rounded-xl font-bold text-zinc-950 text-sm active:scale-95 transition-all shadow-lg shadow-amber-500/20">Sim, Reabrir para Alterações</button>
              <button onClick={() => setIsReopenModalOpen(false)} className="w-full h-11 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-semibold text-zinc-300 text-xs active:scale-95 transition-all">Cancelar e Manter Fechada</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ENDEREÇOS FUZZY */}
      {fuzzyModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between"><div className="flex items-center gap-2.5 text-amber-400"><AlertTriangle size={24} /><h3 className="text-lg font-bold text-zinc-50">Endereços Incompletos</h3></div><button onClick={() => setFuzzyModalOpen(false)} className="text-zinc-500 hover:text-zinc-300"><X size={20}/></button></div>
            <p className="text-xs text-zinc-400 leading-relaxed">Encontramos <strong className="text-zinc-200">{currentFuzzyList.length}</strong> {currentFuzzyList.length === 1 ? 'parada' : 'paradas'} sem número explícito. O Google Maps pode se confundir.</p>
            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
              {currentFuzzyList.map((item, idx) => (
                <div key={idx} className="bg-zinc-950 border border-zinc-800 p-3 rounded-2xl flex flex-col gap-1">
                  <span className="text-xs font-bold text-zinc-200">{item.index}️⃣ {item.name}</span>
                  <span className="text-[11px] text-zinc-400 truncate">🏠 {item.address}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2.5 pt-2">
              <button onClick={() => { if (pendingActionType) executeCopyAction(pendingActionType === 'copy1' ? 1 : 2); }} className="w-full h-12 bg-sky-500 hover:bg-sky-400 rounded-xl font-bold text-zinc-950 text-sm active:scale-95 transition-all shadow-lg shadow-sky-500/20">Prosseguir Mesmo Assim</button>
              <button onClick={() => setFuzzyModalOpen(false)} className="w-full h-11 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-semibold text-zinc-300 text-xs active:scale-95 transition-all">Cancelar e Inserir Links Manuais</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
