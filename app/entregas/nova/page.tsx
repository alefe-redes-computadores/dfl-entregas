'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Store, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/useAppStore';
import { CustomerAutocomplete } from '@/components/deliveries/CustomerAutocomplete';
import type { Delivery, OrderOrigin } from '@/types';

export default function NovaEntregaPage() {
  const router = useRouter();
  const routes = useAppStore((state) => state.routes);
  const customers = useAppStore((state) => state.customers);
  const addDelivery = useAppStore((state) => state.addDelivery);
  const findOrCreateCustomer = useAppStore((state) => state.findOrCreateCustomer);

  const openRoutes = routes.filter(r => r.status === 'aberta');

  const [origin, setOrigin] = useState<OrderOrigin>('ifood');
  const [routeId, setRouteId] = useState('');
  const [customerName, setCustomerName] = useState('');
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
  const [isSaving, setIsSaving] = useState(false);

  const formatCurrencyInput = (inputValue: string) => {
    const onlyDigits = inputValue.replace(/\D/g, '');
    if (!onlyDigits) return '';
    const numberValue = parseInt(onlyDigits, 10) / 100;
    return numberValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleAddressPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (origin !== 'ifood') return; // Só limpa endereço automático se for iFood
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    if (!text) return;
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    const addressParts = [];
    for (const line of lines) {
      const lower = line.toLowerCase();
      if (lower.includes('endereço de entrega')) continue;
      if (line.match(/\d{5}-\d{3}/) || lower.includes('cep')) continue;
      if (lower.includes('patos de minas') || lower.includes('- mg')) continue;
      if (lower.startsWith('obs') || lower.includes('observação')) break;
      addressParts.push(line);
    }
    setAddress(addressParts.join(', '));
    if (lines.length > 1) toast.success('Endereço do iFood formatado!');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routeId || !value || !address) {
      toast.error('Preencha os campos obrigatórios (Rota, Valor e Endereço)');
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

      const customerId = customerName.trim()
        ? await findOrCreateCustomer(customerName, {
            address,
            mapsLink,
            confirmationCode,
            observation,
            origin,
          })
        : undefined;

      const novaEntrega: Delivery = {
        id: Date.now().toString(),
        route_id: routeId,
        origin,
        order_id: orderId || undefined,
        confirmation_code: confirmationCode || undefined,
        customer_id: customerId || '',
        value: cleanValue,
        is_paid: isPaid,
        payment_method: paymentMethod,
        change_for: cleanChangeFor,
        address_string: address,
        maps_link: mapsLink,
        observation,
        drinks,
        updated_at: new Date().toISOString()
      };

      await addDelivery(novaEntrega);
      toast.success('Entrega adicionada com sucesso!');
      router.push('/');
    } finally {
      setIsSaving(false);
    }
  };

  if (openRoutes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center px-4">
        <p className="text-zinc-400">Você precisa abrir uma rota primeiro para lançar entregas.</p>
        <button onClick={() => router.push('/rotas/nova')} className="rounded-xl bg-emerald-500 px-6 py-3 font-bold text-zinc-950">
          Criar Rota Agora
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/')} className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-zinc-400 active:scale-95">
          <ChevronLeft size={22} />
        </button>
        <h1 className="font-heading text-xl font-bold text-zinc-50">Nova Entrega</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5 pb-10">
        
        {/* SELETOR DE ORIGEM (iFood x Loja) */}
        <div className="flex gap-2 p-1 bg-zinc-900 rounded-2xl border border-zinc-800">
          <button
            type="button"
            onClick={() => setOrigin('ifood')}
            className={`flex-1 flex items-center justify-center gap-2 h-12 rounded-xl font-bold transition-all ${
              origin === 'ifood' ? 'bg-red-500 text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Smartphone size={18} /> iFood
          </button>
          <button
            type="button"
            onClick={() => setOrigin('loja')}
            className={`flex-1 flex items-center justify-center gap-2 h-12 rounded-xl font-bold transition-all ${
              origin === 'loja' ? 'bg-emerald-500 text-zinc-950' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
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
            <input
              type="text" inputMode="numeric" placeholder="Ex: 4821" maxLength={4}
              value={orderId} onChange={(e) => setOrderId(e.target.value.replace(/\D/g, ''))} 
              className="h-16 rounded-2xl border-2 border-emerald-500/50 bg-zinc-900/80 px-4 text-xl font-bold text-zinc-50 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
              required={origin === 'ifood'}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-zinc-300">Valor (R$)*</label>
            <input
              type="text" inputMode="numeric" placeholder="0,00"
              value={value} onChange={(e) => setValue(formatCurrencyInput(e.target.value))}
              className="h-16 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 text-xl font-bold text-zinc-50 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
              required
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-zinc-400">Endereço de Entrega*</label>
          <input
            type="text" placeholder="Rua, Número, Bairro"
            value={address} onChange={(e) => setAddress(e.target.value)} onPaste={handleAddressPaste}
            className="h-14 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-zinc-400">Link do Maps</label>
          <input type="url" placeholder="https://maps.google.com/..." value={mapsLink} onChange={(e) => setMapsLink(e.target.value)} className="h-14 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none" />
        </div>

        <div className="flex flex-col gap-2 border-t border-zinc-800 pt-4">
          <label className="text-sm font-semibold text-zinc-400">Forma de Pagamento</label>
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as any)} className="h-14 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 text-zinc-100 focus:border-emerald-500 focus:outline-none">
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
            <input type="text" inputMode="numeric" placeholder="0,00" value={changeFor} onChange={(e) => setChangeFor(formatCurrencyInput(e.target.value))} className="h-14 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none" />
          </div>
        )}

        <div className="flex flex-col gap-2 border-t border-zinc-800 pt-4">
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

        <button type="submit" disabled={isSaving} className="mt-6 h-14 w-full rounded-2xl bg-amber-500 font-bold text-zinc-950 active:scale-[0.98] disabled:opacity-60">
          {isSaving ? 'Salvando...' : 'Salvar Entrega'}
        </button>
      </form>
    </div>
  );
}
