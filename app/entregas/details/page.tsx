'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/useAppStore';
import type { Delivery } from '@/types';

function DeliveryDetailsForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deliveryId = searchParams.get('id');

  const routes = useAppStore((state) => state.routes);
  const deliveries = useAppStore((state) => state.deliveries);
  const updateDelivery = useAppStore((state) => state.updateDelivery);
  
  const openRoutes = routes.filter(r => r.status === 'aberta');

  const [routeId, setRouteId] = useState('');
  const [orderId, setOrderId] = useState('');
  const [value, setValue] = useState('');
  const [address, setAddress] = useState('');
  const [mapsLink, setMapsLink] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<Delivery['payment_method']>('dinheiro');
  const [isPaid, setIsPaid] = useState(false);
  const [changeFor, setChangeFor] = useState('');
  const [drinks, setDrinks] = useState('');
  const [observation, setObservation] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');

  // Máscara de moeda
  const formatCurrencyInput = (inputValue: string) => {
    const onlyDigits = inputValue.replace(/\D/g, '');
    if (!onlyDigits) return '';
    const numberValue = parseInt(onlyDigits, 10) / 100;
    return numberValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Carrega os dados da entrega ao abrir a página
  useEffect(() => {
    if (!deliveryId) return;
    
    const delivery = deliveries.find(d => d.id === deliveryId);
    if (delivery) {
      setRouteId(delivery.route_id);
      setOrderId(delivery.order_id);
      setValue(delivery.value ? delivery.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '');
      setAddress(delivery.address_string);
      setMapsLink(delivery.maps_link || '');
      setPaymentMethod(delivery.payment_method);
      setIsPaid(delivery.is_paid);
      setChangeFor(delivery.change_for ? delivery.change_for.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '');
      setDrinks(delivery.drinks || '');
      setObservation(delivery.observation || '');
      setConfirmationCode(delivery.confirmation_code || '');
    } else {
      toast.error('Entrega não encontrada');
      router.push('/');
    }
  }, [deliveryId, deliveries, router]);

  // Função inteligente que limpa o texto do iFood na hora que cola
  const handleAddressPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    if (!text) return;

    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    const addressParts = [];
    for (const line of lines) {
      const lower = line.toLowerCase();
      if (lower.includes('endereço de entrega') || line.match(/\d{5}-\d{3}/) || lower.includes('cep') || lower.includes('patos de minas') || lower.includes('- mg')) continue;
      if (lower.startsWith('obs') || lower.includes('observação')) break;
      addressParts.push(line);
    }
    setAddress(addressParts.join(', '));
    toast.success('Endereço formatado!');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliveryId || !routeId || !orderId || !value || !address) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    const cleanValue = parseFloat(value.replace(/\./g, '').replace(',', '.'));
    const cleanChangeFor = changeFor ? parseFloat(changeFor.replace(/\./g, '').replace(',', '.')) : undefined;

    await updateDelivery(deliveryId, {
      route_id: routeId,
      order_id: orderId,
      confirmation_code: confirmationCode || undefined,
      value: cleanValue,
      is_paid: isPaid,
      payment_method: paymentMethod,
      change_for: cleanChangeFor,
      address_string: address,
      maps_link: mapsLink,
      observation,
      drinks,
    });

    toast.success('Entrega atualizada com sucesso!');
    router.push('/');
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <button 
          onClick={() => router.push('/')}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-zinc-400 active:scale-95"
        >
          <ChevronLeft size={22} />
        </button>
        <h1 className="font-heading text-xl font-bold text-zinc-50">Editar Entrega</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5 pb-10">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-zinc-400">Selecionar Rota</label>
          <select 
            value={routeId}
            onChange={(e) => setRouteId(e.target.value)}
            className="h-14 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 text-zinc-100 focus:border-emerald-500 focus:outline-none"
            required
          >
            <option value="">Selecione...</option>
            {openRoutes.map(r => (
              <option key={r.id} value={r.id}>{r.name} ({r.motoboy_name})</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-emerald-400">Número do Pedido</label>
            <input
              type="text" inputMode="numeric" placeholder="Ex: 4821" maxLength={4}
              value={orderId} onChange={(e) => setOrderId(e.target.value.replace(/\D/g, ''))}
              className="h-16 rounded-2xl border-2 border-emerald-500/50 bg-zinc-900/80 px-4 text-xl font-bold text-zinc-50 focus:border-emerald-500 focus:outline-none" required
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-zinc-300">Valor (R$)</label>
            <input
              type="text" inputMode="numeric" placeholder="0,00"
              value={value} onChange={(e) => setValue(formatCurrencyInput(e.target.value))}
              className="h-16 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 text-xl font-bold text-zinc-50 focus:border-emerald-500 focus:outline-none" required
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-zinc-400">Endereço de Entrega</label>
          <input
            type="text" value={address} onChange={(e) => setAddress(e.target.value)} onPaste={handleAddressPaste}
            className="h-14 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 text-zinc-100 focus:border-emerald-500 focus:outline-none" required
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-zinc-400">Link do Maps</label>
          <input
            type="url" placeholder="https://maps.google.com/..."
            value={mapsLink} onChange={(e) => setMapsLink(e.target.value)}
            className="h-14 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 text-zinc-100 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-2 border-t border-zinc-800 pt-4">
          <label className="text-sm font-semibold text-zinc-400">Forma de Pagamento</label>
          <select 
            value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as any)}
            className="h-14 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 text-zinc-100 focus:border-emerald-500 focus:outline-none"
          >
            <option value="dinheiro">Dinheiro</option>
            <option value="pix">Pix</option>
            <option value="cartao_credito">Cartão de Crédito</option>
            <option value="cartao_debito">Cartão de Débito</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <input type="checkbox" id="isPaid" checked={isPaid} onChange={(e) => setIsPaid(e.target.checked)} className="h-6 w-6 rounded-md accent-emerald-500" />
          <label htmlFor="isPaid" className="font-semibold text-zinc-200">Pedido já está pago?</label>
        </div>

        {paymentMethod === 'dinheiro' && !isPaid && (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-zinc-400">Troco para (R$)</label>
            <input type="text" inputMode="numeric" placeholder="0,00" value={changeFor} onChange={(e) => setChangeFor(formatCurrencyInput(e.target.value))} className="h-14 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 text-zinc-100 focus:border-emerald-500 focus:outline-none" />
          </div>
        )}

        <div className="flex flex-col gap-2 border-t border-zinc-800 pt-4">
          <label className="text-sm font-semibold text-zinc-400">Bebidas (Opcional)</label>
          <input type="text" placeholder="Ex: 1 Coca 2L" value={drinks} onChange={(e) => setDrinks(e.target.value)} className="h-14 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 text-zinc-100 focus:border-emerald-500 focus:outline-none" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-zinc-400">Cód. Confirmação</label>
            <input type="text" inputMode="numeric" maxLength={4} value={confirmationCode} onChange={(e) => setConfirmationCode(e.target.value.replace(/\D/g, ''))} className="h-14 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 text-zinc-100 focus:border-emerald-500 focus:outline-none" />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-zinc-400">Observação</label>
            <input type="text" value={observation} onChange={(e) => setObservation(e.target.value)} className="h-14 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 text-zinc-100 focus:border-emerald-500 focus:outline-none" />
          </div>
        </div>

        <button type="submit" className="mt-6 h-14 w-full rounded-2xl bg-amber-500 font-bold text-zinc-950 active:scale-[0.98]">
          Atualizar Entrega
        </button>
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
