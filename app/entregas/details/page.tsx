'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Store, Smartphone, Trash2, Banknote, QrCode, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/useAppStore';
import { CustomerAutocomplete } from '@/components/deliveries/CustomerAutocomplete';
import type { Delivery, OrderOrigin } from '@/types';

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

  const openRoutes = routes.filter(r => r.status === 'aberta');

  const [origin, setOrigin] = useState<OrderOrigin>('ifood');
  const [routeId, setRouteId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [orderId, setOrderId] = useState('');
  const [value, setValue] = useState('');
  
  const [streetAddress, setStreetAddress] = useState(''); // Separado Rua
  const [neighborhood, setNeighborhood] = useState(''); // Separado Bairro
  
  const [mapsLink, setMapsLink] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<Delivery['payment_method']>('dinheiro');
  const [isPaid, setIsPaid] = useState(false);
  const [changeFor, setChangeFor] = useState('');
  const [drinks, setDrinks] = useState('');
  const [observation, setObservation] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const formatCurrencyInput = (inputValue: string) => {
    const onlyDigits = inputValue.replace(/\D/g, '');
    if (!onlyDigits) return '';
    const numberValue = parseInt(onlyDigits, 10) / 100;
    return numberValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  useEffect(() => {
    if (!deliveryId) return;

    const delivery = deliveries.find(d => d.id === deliveryId);
    if (delivery) {
      setOrigin(delivery.origin || 'ifood');
      setRouteId(delivery.route_id);
      setOrderId(delivery.order_id || '');
      setValue(delivery.value ? delivery.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '');
      
      // Inteligência para separar Rua e Bairro ao editar
      let street = delivery.address_string;
      let hood = '';
      if (street.includes(',')) {
         const parts = street.split(',');
         hood = parts.pop()?.trim() || '';
         street = parts.join(',').trim();
      } else if (street.includes('-')) {
         const parts = street.split('-');
         hood = parts.pop()?.trim() || '';
         street = parts.join('-').trim();
      }
      setStreetAddress(street);
      setNeighborhood(hood);

      setMapsLink(delivery.maps_link || '');
      
      // Ajusta compatibilidade com o formato novo
      let method = delivery.payment_method;
      if (method.includes('cartao')) method = 'cartao';
      setPaymentMethod(method as any);
      
      setIsPaid(delivery.is_paid);
      setChangeFor(delivery.change_for ? delivery.change_for.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '');
      setDrinks(delivery.drinks || '');
      setObservation(delivery.observation || '');
      setConfirmationCode(delivery.confirmation_code || '');

      const existingCustomer = getCustomerById(delivery.customer_id);
      setCustomerName(existingCustomer?.name || '');
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
      toast.error('Pedidos do iFood exigem o Número do Pedido.');
      return;
    }

    setIsSaving(true);
    try {
      const cleanValue = parseFloat(value.replace(/\./g, '').replace(',', '.'));
      const cleanChangeFor = changeFor ? parseFloat(changeFor.replace(/\./g, '').replace(',', '.')) : undefined;

      // Junta bonito pro banco de dados
      const fullAddressString = neighborhood 
        ? `${streetAddress}, ${neighborhood}` 
        : streetAddress;

      const customerId = customerName.trim()
        ? await findOrCreateCustomer(customerName, {
            address: fullAddressString, 
            mapsLink, 
            confirmationCode, 
            observation, 
            origin
          })
        : undefined;

      await updateDelivery(deliveryId, {
        route_id: routeId,
        origin,
        order_id: orderId || undefined,
        confirmation_code: confirmationCode || undefined,
        customer_id: customerId || '',
        value: cleanValue,
        is_paid: isPaid,
        payment_method: paymentMethod,
        change_for: cleanChangeFor,
        address_string: fullAddressString,
        maps_link: mapsLink,
        observation,
        drinks,
      } as Partial<Delivery>);

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

  return (
    <div className="flex flex-col gap-6 relative">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/')} className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-zinc-400 active:scale-95">
          <ChevronLeft size={22} />
        </button>
        <h1 className="font-heading text-xl font-bold text-zinc-50">Editar Entrega</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5 pb-10">
        
        {/* SELETOR DE ORIGEM (iFood x Loja) */}
        <div className="flex gap-2 p-1 bg-zinc-900 rounded-2xl border border-zinc-800">
          <button type="button" onClick={() => setOrigin('ifood')} className={`flex-1 flex items-center justify-center gap-2 h-12 rounded-xl font-bold transition-all ${origin === 'ifood' ? 'bg-red-500 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
            <Smartphone size={18} /> iFood
          </button>
          <button type="button" onClick={() => setOrigin('loja')} className={`flex-1 flex items-center justify-center gap-2 h-12 rounded-xl font-bold transition-all ${origin === 'loja' ? 'bg-emerald-500 text-zinc-950' : 'text-zinc-500 hover:text-zinc-300'}`}>
            <Store size={18} /> Loja Própria
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-zinc-400">Selecionar Rota</label>
          <select value={routeId} onChange={(e) => setRouteId(e.target.value)} className="h-14 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 text-zinc-100 focus:border-emerald-500 focus:outline-none" required>
            <option value="">Selecione...</option>
            {openRoutes.map(r => <option key={r.id} value={r.id}>{r.name} ({r.motoboy_name})</option>)}
          </select>
        </div>

        <CustomerAutocomplete value={customerName} onChange={setCustomerName} customers={customers} />

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-emerald-400">
              {origin === 'ifood' ? 'Nº do Pedido*' : 'Nº Pedido (Opcional)'}
            </label>
            <input type="text" inputMode="numeric" placeholder="Ex: 4821" maxLength={4} value={orderId} onChange={(e) => setOrderId(e.target.value.replace(/\D/g, ''))} className="h-16 rounded-2xl border-2 border-emerald-500/50 bg-zinc-900/80 px-4 text-xl font-bold text-zinc-50 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none" required={origin === 'ifood'} />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-zinc-300">Valor (R$)*</label>
            <input type="text" inputMode="numeric" placeholder="0,00" value={value} onChange={(e) => setValue(formatCurrencyInput(e.target.value))} className="h-16 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 text-xl font-bold text-zinc-50 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none" required />
          </div>
        </div>

        {/* ENDEREÇO FATIADO */}
        <div className="flex flex-col gap-4 border-t border-zinc-800 pt-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-zinc-400">Rua e Número*</label>
            <input type="text" value={streetAddress} onChange={(e) => setStreetAddress(e.target.value)} className="h-14 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none" required />
          </div>
          
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-zinc-400">Bairro</label>
            <input type="text" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} className="h-14 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none" />
          </div>
        </div>

        {/* FORMA DE PAGAMENTO UI MODERNA */}
        <div className="flex flex-col gap-3 border-t border-zinc-800 pt-5">
          <label className="text-sm font-semibold text-zinc-400">Forma de Pagamento</label>
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => setPaymentMethod('dinheiro')} className={`flex flex-col items-center justify-center gap-2 h-20 rounded-2xl border-2 transition-all ${paymentMethod === 'dinheiro' ? 'border-amber-500 bg-amber-500/10 text-amber-500' : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:bg-zinc-800'}`}>
              <Banknote size={24} />
              <span className="text-xs font-bold">Dinheiro</span>
            </button>
            <button type="button" onClick={() => setPaymentMethod('pix')} className={`flex flex-col items-center justify-center gap-2 h-20 rounded-2xl border-2 transition-all ${paymentMethod === 'pix' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500' : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:bg-zinc-800'}`}>
              <QrCode size={24} />
              <span className="text-xs font-bold">Pix</span>
            </button>
            <button type="button" onClick={() => setPaymentMethod('cartao')} className={`flex flex-col items-center justify-center gap-2 h-20 rounded-2xl border-2 transition-all ${paymentMethod === 'cartao' ? 'border-sky-500 bg-sky-500/10 text-sky-500' : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:bg-zinc-800'}`}>
              <CreditCard size={24} />
              <span className="text-xs font-bold">Cartão</span>
            </button>
          </div>
        </div>

        {/* TOGGLE PAGO UI MODERNA */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800 mt-2">
          <div className="flex flex-col">
            <span className="font-bold text-zinc-200">Pedido já está pago?</span>
            <span className="text-xs text-zinc-500">Marque se já foi recebido no iFood/Loja</span>
          </div>
          <button type="button" onClick={() => setIsPaid(!isPaid)} className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-300 ${isPaid ? 'bg-emerald-500' : 'bg-zinc-700'}`}>
            <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform duration-300 ${isPaid ? 'translate-x-7' : 'translate-x-1'}`} />
          </button>
        </div>

        {paymentMethod === 'dinheiro' && !isPaid && (
          <div className="flex flex-col gap-2 mt-2">
            <label className="text-sm font-semibold text-zinc-400">Troco para (R$)</label>
            <input type="text" inputMode="numeric" placeholder="Ex: 50,00" value={changeFor} onChange={(e) => setChangeFor(formatCurrencyInput(e.target.value))} className="h-14 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none" />
          </div>
        )}

        <div className="flex flex-col gap-2 border-t border-zinc-800 pt-5 mt-2">
          <label className="text-sm font-semibold text-zinc-400">Bebidas (Opcional)</label>
          <input type="text" placeholder="Ex: 1 Coca 2L" value={drinks} onChange={(e) => setDrinks(e.target.value)} className="h-14 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-zinc-400">Cód. Confirmação</label>
            <input type="text" inputMode="numeric" placeholder="Ex: 1234" maxLength={4} value={confirmationCode} onChange={(e) => setConfirmationCode(e.target.value.replace(/\D/g, ''))} className="h-14 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none" />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-zinc-400">Observação</label>
            <input type="text" placeholder="Ex: Portão azul" value={observation} onChange={(e) => setObservation(e.target.value)} className="h-14 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none" />
          </div>
        </div>

        <div className="flex flex-col gap-3 mt-6">
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
