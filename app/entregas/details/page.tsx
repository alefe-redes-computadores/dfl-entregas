
'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  ChevronLeft, Store, Smartphone, Trash2, Banknote, QrCode, CreditCard, 
  ChevronDown, AlertTriangle, Navigation, CheckCircle2, Link2, MessageCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/useAppStore';
import { CustomerAutocomplete } from '@/components/deliveries/CustomerAutocomplete';
import { AddressAutocomplete } from '@/components/deliveries/AddressAutocomplete'; 
import { extractCoordinatesFromUrl } from '@/lib/maps';
import type { Delivery, OrderOrigin, Customer } from '@/types';

function DeliveryDetailsForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deliveryId = searchParams.get('id');

  const routes = useAppStore((state) => state.routes);
  const deliveries = useAppStore((state) => state.deliveries);
  const customers = useAppStore((state) => state.customers);
  const updateDelivery = useAppStore((state) => state.updateDelivery);
  const deleteDelivery = useAppStore((state) => state.deleteDelivery);
  const getCustomerById = useAppStore((state) => state.getCustomerById);
  const findOrCreateCustomer = useAppStore((state) => state.findOrCreateCustomer);

  // Bloco 1: Origem e Rota
  const [origin, setOrigin] = useState<OrderOrigin>('ifood');
  const [routeId, setRouteId] = useState('');
  const [isRouteDropdownOpen, setIsRouteDropdownOpen] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [ifoodId, setIfoodId] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');

  // Bloco 2: Cliente e Contato
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(false);

  // Bloco 3: Endereço e Satélite
  const [streetAddress, setStreetAddress] = useState('');
  const [mapsLink, setMapsLink] = useState('');

  // Bloco 4: Financeiro e Carga
  const [value, setValue] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<Delivery['payment_method']>('dinheiro');
  const [isPaid, setIsPaid] = useState(false);
  const [changeFor, setChangeFor] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [drinks, setDrinks] = useState('');
  const [observation, setObservation] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const formatCurrencyInput = (inputValue: string) => {
    const onlyDigits = inputValue.replace(/\D/g, '');
    if (!onlyDigits) return '';
    const numberValue = parseInt(onlyDigits, 10) / 100;
    return numberValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatPhoneInput = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  // Feedback Inteligente de Localização na Edição
  const addressAudit = useMemo(() => {
    const coords = extractCoordinatesFromUrl(mapsLink);
    if (coords || (mapsLink && mapsLink.includes('http'))) {
      return {
        status: 'precise' as const,
        title: 'Localização 100% Precisa',
        desc: 'Link/Coordenada válida. O GPS levará o motoboy direto ao ponto.'
      };
    }

    const hasNumber = /\d+/.test(streetAddress);
    if (streetAddress.trim().length > 3 && hasNumber) {
      return {
        status: 'good' as const,
        title: 'Endereço com Número',
        desc: 'Rua e número identificados para Patos de Minas.'
      };
    }

    if (streetAddress.trim().length > 0 && !hasNumber) {
      return {
        status: 'warning' as const,
        title: 'Atenção: Endereço Sem Número!',
        desc: 'O Maps pode traçar rota incompleta. Recomendado colar o link do Maps.'
      };
    }

    return null;
  }, [streetAddress, mapsLink]);

  const handleCustomerSelect = (c: Customer) => {
    if (c.address) setStreetAddress(c.address);
    if (c.phone) setPhone(formatPhoneInput(c.phone));
    if (c.observation) setObservation(c.observation);
    if (c.maps_link) setMapsLink(c.maps_link);
    toast.success('Dados do cliente preenchidos automaticamente! 🪄');
  };

  const handleMapsLinkChange = (link: string) => {
    setMapsLink(link);
    const coords = extractCoordinatesFromUrl(link);
    if (coords) {
      toast.success('Ponto exato capturado com precisão! 📍', {
        description: `Coordenadas: ${coords}`,
        duration: 2000
      });
    }
  };

  const handlePaymentMethodChange = (method: string) => {
    setPaymentMethod(method as any);
    if (method === 'cartao') setIsPaid(false);
  };

  useEffect(() => {
    if (!deliveryId) return;

    const delivery = deliveries.find(d => d.id === deliveryId);
    if (delivery) {
      setOrigin(delivery.origin || 'ifood');
      setRouteId(delivery.route_id);
      setOrderId(delivery.order_id || '');
      setIfoodId(delivery.ifood_id || '');
      setValue(delivery.value ? delivery.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '');
      setStreetAddress(delivery.address_string || '');
      setMapsLink(delivery.maps_link || '');
      
      let method = delivery.payment_method as string;
      if (method.includes('cartao')) method = 'cartao';
      setPaymentMethod(method as any);
      
      setIsPaid(delivery.is_paid);
      setIsUrgent(delivery.is_urgent || false);
      setChangeFor(delivery.change_for ? delivery.change_for.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '');
      setDrinks(delivery.drinks || '');
      setObservation(delivery.observation || '');
      setConfirmationCode(delivery.confirmation_code || '');
      setNotifyWhatsapp(delivery.notify_whatsapp || false);

      const existingCustomer = getCustomerById(delivery.customer_id);
      setCustomerName(existingCustomer?.name || '');
      
      const rawP = delivery.phone || existingCustomer?.phone || '';
      if (rawP) setPhone(formatPhoneInput(rawP));
    } else {
      toast.error('Entrega não encontrada');
      router.push('/');
    }
  }, [deliveryId, deliveries, router, getCustomerById]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliveryId || !routeId || !value || !streetAddress) {
      toast.error('Preencha os campos obrigatórios (Rota, Valor e Rua)');
      return;
    }
    if (origin === 'ifood' && !orderId) {
      toast.error('Pedidos do iFood exigem o Número do Pedido (Curto).');
      return;
    }

    setIsSaving(true);
    try {
      const cleanValue = parseFloat(value.replace(/\./g, '').replace(',', '.'));
      const cleanChangeFor = changeFor ? parseFloat(changeFor.replace(/\./g, '').replace(',', '.')) : undefined;
      const cleanStreet = streetAddress.trim().replace(/[,|-]\s*$/, '');
      const rawPhone = phone.replace(/\D/g, '');

      const customerId = customerName.trim()
        ? await findOrCreateCustomer(customerName, {
            address: cleanStreet, 
            phone: rawPhone || undefined,
            mapsLink, 
            confirmationCode: origin === 'ifood' ? confirmationCode : undefined, 
            observation, 
            origin
          })
        : undefined;

      await updateDelivery(deliveryId, {
        route_id: routeId,
        origin,
        order_id: origin === 'ifood' ? (orderId || undefined) : undefined,
        ifood_id: origin === 'ifood' ? (ifoodId || undefined) : undefined,
        confirmation_code: origin === 'ifood' ? (confirmationCode || undefined) : undefined,
        customer_id: customerId || '',
        value: cleanValue,
        is_paid: isPaid,
        is_urgent: isUrgent,
        payment_method: paymentMethod,
        change_for: cleanChangeFor,
        address_string: cleanStreet,
        maps_link: mapsLink,
        phone: rawPhone || undefined,
        notify_whatsapp: notifyWhatsapp,
        observation,
        drinks,
      } as any);

      toast.success('Entrega atualizada com sucesso!');
      router.push('/');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deliveryId) return;
    const confirm = window.confirm("Tem certeza que deseja excluir esta entrega permanentemente?");
    if (!confirm) return;

    setIsDeleting(true);
    try {
      await deleteDelivery(deliveryId);
      toast.success('Entrega excluída com sucesso!');
      router.push('/');
    } catch (error) {
      toast.error('Erro ao excluir entrega.');
      setIsDeleting(false);
    }
  };

  const routeOptions = routes.filter(r => r.status === 'aberta' || r.id === routeId);

  return (
    <div className="flex flex-col gap-6 relative">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/')} className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-zinc-400 active:scale-95">
          <ChevronLeft size={22} />
        </button>
        <h1 className="font-heading text-xl font-bold text-zinc-50">Editar Entrega</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5 pb-10">
        
        {/* BLOCO 1: ORIGEM E ROTA */}
        <div className="flex gap-2 p-1 bg-zinc-900 rounded-2xl border border-zinc-800">
          <button type="button" onClick={() => setOrigin('ifood')} className={`flex-1 flex items-center justify-center gap-2 h-12 rounded-xl font-bold transition-all ${origin === 'ifood' ? 'bg-red-500 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
            <Smartphone size={18} /> iFood
          </button>
          <button type="button" onClick={() => { setOrigin('loja'); setOrderId(''); setIfoodId(''); setConfirmationCode(''); }} className={`flex-1 flex items-center justify-center gap-2 h-12 rounded-xl font-bold transition-all ${origin === 'loja' ? 'bg-emerald-500 text-zinc-950' : 'text-zinc-500 hover:text-zinc-300'}`}>
            <Store size={18} /> Loja Própria
          </button>
        </div>

        <div className="relative flex flex-col gap-2">
          <label className="text-sm font-semibold text-zinc-400">Selecionar Rota</label>
          <button
            type="button"
            onClick={() => setIsRouteDropdownOpen(!isRouteDropdownOpen)}
            className={`flex h-14 w-full items-center justify-between rounded-2xl border bg-zinc-900/50 px-4 text-left transition-colors ${isRouteDropdownOpen ? 'border-emerald-500' : 'border-zinc-800'}`}
          >
            <span className={routeId ? 'text-zinc-100' : 'text-zinc-500'}>
              {routeId ? (
                <span className="font-semibold">
                  {routeOptions.find(r => r.id === routeId)?.name} <span className="text-zinc-400 font-normal">({routeOptions.find(r => r.id === routeId)?.motoboy_name}) {routeOptions.find(r => r.id === routeId)?.status === 'fechada' && '🔒'}</span>
                </span>
              ) : 'Selecione a rota...'}
            </span>
            <ChevronDown size={20} className={`text-zinc-500 transition-transform ${isRouteDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isRouteDropdownOpen && <div className="fixed inset-0 z-20" onClick={() => setIsRouteDropdownOpen(false)} />}

          {isRouteDropdownOpen && (
            <div className="absolute top-[84px] z-30 flex max-h-56 w-full flex-col overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
              {routeOptions.map(r => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => { setRouteId(r.id); setIsRouteDropdownOpen(false); }}
                  className="flex items-center justify-between px-4 py-4 text-left text-sm active:bg-zinc-800 border-b border-zinc-800/50 last:border-0"
                >
                  <span className={`font-semibold ${routeId === r.id ? 'text-emerald-500' : 'text-zinc-200'}`}>
                    {r.name} <span className={routeId === r.id ? 'text-emerald-500/70' : 'text-zinc-500 font-normal'}>({r.motoboy_name}) {r.status === 'fechada' && '🔒'}</span>
                  </span>
                  {routeId === r.id ? (
                    <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                  ) : (
                    <div className="h-2 w-2 rounded-full border border-zinc-600" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* IDENTIFICADORES DO IFOOD */}
        {origin === 'ifood' && (
          <div className="grid grid-cols-3 gap-2 animate-in fade-in">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-emerald-400">Nº Curto*</label>
              <input 
                type="text" 
                inputMode="numeric" 
                placeholder="Ex: 4821" 
                maxLength={5} 
                value={orderId} 
                onChange={(e) => setOrderId(e.target.value.replace(/\D/g, ''))} 
                className="h-12 rounded-xl border-2 border-emerald-500/50 bg-zinc-900/80 px-3 text-base font-bold text-zinc-50 focus:border-emerald-500 focus:outline-none" 
                required 
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-400">ID Completo</label>
              <input 
                type="text" 
                placeholder="Ex: 12345678" 
                value={ifoodId} 
                onChange={(e) => setIfoodId(e.target.value.replace(/\D/g, ''))} 
                className="h-12 rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none" 
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-400">Código</label>
              <input 
                type="text" 
                inputMode="numeric" 
                placeholder="Ex: 1234" 
                maxLength={4} 
                value={confirmationCode} 
                onChange={(e) => setConfirmationCode(e.target.value.replace(/\D/g, ''))} 
                className="h-12 rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none" 
              />
            </div>
          </div>
        )}

        {/* BLOCO 2: CLIENTE E WHATSAPP */}
        <div className="flex flex-col gap-3 border-t border-zinc-800 pt-4">
          <CustomerAutocomplete value={customerName} onChange={setCustomerName} onSelect={handleCustomerSelect} customers={customers} />
          
          <div className="grid grid-cols-1 gap-2">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <input 
                  type="text" 
                  inputMode="tel" 
                  placeholder="WhatsApp: (34) 99999-9999" 
                  value={phone} 
                  onChange={(e) => setPhone(formatPhoneInput(e.target.value))} 
                  className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => setNotifyWhatsapp(!notifyWhatsapp)}
                className={`flex items-center gap-1.5 h-12 px-4 rounded-xl border text-xs font-bold transition-all active:scale-95 ${
                  notifyWhatsapp 
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-sm' 
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                }`}
              >
                <MessageCircle size={15} /> Avisar no Zap
              </button>
            </div>
          </div>
        </div>

        {/* BLOCO 3: ENDEREÇO E LINK MAPS (JUNTOS) */}
        <div className="flex flex-col gap-3 border-t border-zinc-800 pt-4">
          <AddressAutocomplete 
            value={streetAddress} 
            onChange={setStreetAddress} 
            placeholder="Ex: Rua Major Gote, 100, Bairro"
            label="Endereço da Entrega*"
          />

          {/* Feedback Visual de Localização */}
          {addressAudit && (
            <div className={`p-3 rounded-xl border transition-all flex items-start gap-2.5 ${
              addressAudit.status === 'precise' 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                : addressAudit.status === 'good'
                ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            }`}>
              <div className="mt-0.5 shrink-0">
                {addressAudit.status === 'precise' ? (
                  <Navigation size={16} className="animate-pulse" />
                ) : addressAudit.status === 'good' ? (
                  <CheckCircle2 size={16} />
                ) : (
                  <AlertTriangle size={16} />
                )}
              </div>
              <div className="flex flex-col flex-1">
                <span className="text-xs font-bold">{addressAudit.title}</span>
                <span className="text-[11px] text-zinc-300 mt-0.5 leading-relaxed">{addressAudit.desc}</span>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5 mt-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1">
                <Link2 size={13} className="text-sky-400" /> Link Manual / Coordenadas (Opcional)
              </label>
            </div>
            <input 
              type="text" 
              placeholder="Cole o link do Maps ou coordenadas @lat,lng" 
              value={mapsLink} 
              onChange={(e) => handleMapsLinkChange(e.target.value)} 
              className="h-12 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none" 
            />
          </div>
        </div>

        {/* BLOCO 4: FINANCEIRO, CARGA E OBS */}
        <div className="flex flex-col gap-4 border-t border-zinc-800 pt-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-zinc-300">Valor (R$)*</label>
              <input 
                type="text" 
                inputMode="numeric" 
                placeholder="0,00" 
                value={value} 
                onChange={(e) => setValue(formatCurrencyInput(e.target.value))} 
                className="h-14 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 text-xl font-bold text-zinc-50 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none" 
                required 
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-400">Bebidas</label>
              <input 
                type="text" 
                placeholder="Ex: 1 Coca 2L" 
                value={drinks} 
                onChange={(e) => setDrinks(e.target.value)} 
                className="h-14 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none" 
              />
            </div>
          </div>

          <div className={`flex flex-col gap-2 transition-all duration-300 ${isPaid ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
            <label className="text-xs font-semibold text-zinc-400">Forma de Pagamento</label>
            <div className="grid grid-cols-3 gap-2">
              <button type="button" onClick={() => handlePaymentMethodChange('dinheiro')} className={`flex flex-col items-center justify-center gap-1.5 h-16 rounded-xl border-2 transition-all ${paymentMethod === 'dinheiro' ? 'border-amber-500 bg-amber-500/10 text-amber-500' : 'border-zinc-800 bg-zinc-900/50 text-zinc-400'}`}>
                <Banknote size={20} />
                <span className="text-xs font-bold">Dinheiro</span>
              </button>
              <button type="button" onClick={() => handlePaymentMethodChange('pix')} className={`flex flex-col items-center justify-center gap-1.5 h-16 rounded-xl border-2 transition-all ${paymentMethod === 'pix' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500' : 'border-zinc-800 bg-zinc-900/50 text-zinc-400'}`}>
                <QrCode size={20} />
                <span className="text-xs font-bold">Pix</span>
              </button>
              <button type="button" onClick={() => handlePaymentMethodChange('cartao')} className={`flex flex-col items-center justify-center gap-1.5 h-16 rounded-xl border-2 transition-all ${(paymentMethod as string) === 'cartao' ? 'border-sky-500 bg-sky-500/10 text-sky-500' : 'border-zinc-800 bg-zinc-900/50 text-zinc-400'}`}>
                <CreditCard size={20} />
                <span className="text-xs font-bold">Cartão</span>
              </button>
            </div>
          </div>

          {(paymentMethod as string) !== 'cartao' && (
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-900/50 border border-zinc-800">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-zinc-200">Pago antecipado?</span>
                <span className="text-[10px] text-zinc-500">Marque se já está pago no app/chave</span>
              </div>
              <button type="button" onClick={() => setIsPaid(!isPaid)} className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 ${isPaid ? 'bg-emerald-500' : 'bg-zinc-700'}`}>
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ${isPaid ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          )}

          {paymentMethod === 'dinheiro' && !isPaid && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-400">Troco para (R$)</label>
              <input type="text" inputMode="numeric" placeholder="Ex: 50,00" value={changeFor} onChange={(e) => setChangeFor(formatCurrencyInput(e.target.value))} className="h-12 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none" />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-400">Observação / Portão / Interfone</label>
            <input type="text" placeholder="Ex: Portão preto, interfone estragado..." value={observation} onChange={(e) => setObservation(e.target.value)} className="h-12 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none" />
          </div>

          <div className={`flex items-center justify-between p-3.5 rounded-xl transition-all border ${isUrgent ? 'bg-red-500/10 border-red-500/30' : 'bg-zinc-900/50 border-zinc-800'}`}>
            <div className="flex flex-col">
              <span className={`text-xs font-bold flex items-center gap-1.5 ${isUrgent ? 'text-red-400' : 'text-zinc-300'}`}>
                <AlertTriangle size={15} className={isUrgent ? "text-red-500" : "text-zinc-500"} /> Entrega Urgente?
              </span>
              <span className="text-[10px] text-zinc-500">Prioridade na sequência da rota</span>
            </div>
            <button type="button" onClick={() => setIsUrgent(!isUrgent)} className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 ${isUrgent ? 'bg-red-500' : 'bg-zinc-700'}`}>
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ${isUrgent ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3 mt-4">
          <button type="submit" disabled={isSaving || isDeleting} className="h-14 w-full rounded-2xl bg-amber-500 font-bold text-zinc-950 active:scale-[0.98] disabled:opacity-60 shadow-lg shadow-amber-500/20">
            {isSaving ? 'Salvando...' : 'Atualizar Entrega'}
          </button>
          
          <button type="button" onClick={handleDelete} disabled={isSaving || isDeleting} className="flex items-center justify-center gap-2 h-14 w-full rounded-2xl border border-red-500/50 text-red-500 font-bold hover:bg-red-500/10 active:scale-[0.98] disabled:opacity-60 transition-colors">
            <Trash2 size={18} />
            {isDeleting ? 'Excluindo...' : 'Excluir Entrega'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function DetailsPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-zinc-500">Carregando detalhes...</div>}>
      <DeliveryDetailsForm />
    </Suspense>
  );
}
