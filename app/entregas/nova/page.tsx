'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/useAppStore';
import type { Delivery } from '@/types';

export default function NovaEntregaPage() {
  const router = useRouter();
  const routes = useAppStore((state) => state.routes);
  const addDelivery = useAppStore((state) => state.addDelivery);
  
  const openRoutes = routes.filter(r => r.status === 'aberta');

  const [routeId, setRouteId] = useState('');
  const [orderId, setOrderId] = useState('');
  const [value, setValue] = useState(''); // Usa string para manter a máscara "0,00"
  const [address, setAddress] = useState('');
  const [mapsLink, setMapsLink] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<Delivery['payment_method']>('dinheiro');
  const [isPaid, setIsPaid] = useState(false);
  const [changeFor, setChangeFor] = useState('');
  const [drinks, setDrinks] = useState('');
  const [observation, setObservation] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');

  // Função que cria a máscara de dinheiro (começa dos centavos)
  const formatCurrencyInput = (inputValue: string) => {
    // Remove tudo que não for número
    const onlyDigits = inputValue.replace(/\D/g, '');
    if (!onlyDigits) return '';
    
    // Transforma em número decimal (divide por 100)
    const numberValue = parseInt(onlyDigits, 10) / 100;
    
    // Formata para o padrão brasileiro: "63,25" ou "1.234,56"
    return numberValue.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Função inteligente que limpa o texto do iFood na hora que você cola
  const handleAddressPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    
    if (!text) return;

    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    const addressParts = [];
    
    for (const line of lines) {
      const lower = line.toLowerCase();
      // Ignora cabeçalhos do iFood
      if (lower.includes('endereço de entrega')) continue;
      // Ignora linhas com CEP
      if (line.match(/\d{5}-\d{3}/) || lower.includes('cep')) continue;
      // Ignora a cidade/estado para encurtar
      if (lower.includes('patos de minas') || lower.includes('- mg')) continue;
      // Para de ler assim que chegar na observação
      if (lower.startsWith('obs') || lower.includes('observação')) break;
      
      addressParts.push(line);
    }
    
    // Junta as partes válidas com vírgula e preenche o campo
    const cleanAddress = addressParts.join(', ');
    setAddress(cleanAddress);
    
    if (lines.length > 1) {
      toast.success('Endereço do iFood limpo e formatado!');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routeId || !orderId || !value || !address) {
      toast.error('Preencha os campos obrigatórios (Rota, Pedido, Valor e Endereço)');
      return;
    }

    // Limpa a máscara de R$ para converter em número para o banco de dados
    const cleanValue = parseFloat(value.replace(/\./g, '').replace(',', '.'));
    const cleanChangeFor = changeFor ? parseFloat(changeFor.replace(/\./g, '').replace(',', '.')) : undefined;

    // Usamos 'as any' aqui para o TypeScript ignorar o erro do 'createdAt'
    const novaEntrega = {
      id: Date.now().toString(),
      route_id: routeId,
      order_id: orderId,
      confirmation_code: confirmationCode || undefined,
      customer_id: 'temp-id',
      value: cleanValue,
      is_paid: isPaid,
      payment_method: paymentMethod,
      change_for: cleanChangeFor,
      address_string: address,
      maps_link: mapsLink,
      observation,
      drinks,
      createdAt: new Date().toISOString()
    } as any; 

    await addDelivery(novaEntrega);
    toast.success('Entrega adicionada com sucesso!');
    router.push('/');
  };

  if (openRoutes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center px-4">
        <p className="text-zinc-400">Você precisa abrir uma rota primeiro para lançar entregas.</p>
        <button 
          onClick={() => router.push('/rotas/nova')}
          className="rounded-xl bg-emerald-500 px-6 py-3 font-bold text-zinc-950"
        >
          Criar Rota Agora
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <button 
          onClick={() => router.push('/')}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-zinc-400 active:scale-95"
        >
          <ChevronLeft size={22} />
        </button>
        <h1 className="font-heading text-xl font-bold text-zinc-50">Nova Entrega</h1>
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

        {/* DESTAQUE: Número do Pedido e Valor (AGORA COM MÁSCARA) */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-emerald-400">Número do Pedido</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Ex: 4821"
              maxLength={4}
              value={orderId}
              onChange={(e) => setOrderId(e.target.value.replace(/\D/g, ''))} // Só aceita números
              className="h-16 rounded-2xl border-2 border-emerald-500/50 bg-zinc-900/80 px-4 text-xl font-bold text-zinc-50 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-zinc-300">Valor (R$)</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="0,00"
              value={value}
              onChange={(e) => setValue(formatCurrencyInput(e.target.value))}
              className="h-16 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 text-xl font-bold text-zinc-50 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
              required
            />
          </div>
        </div>

        {/* ENDEREÇO COM FILTRO DO IFOOD */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-zinc-400">Endereço de Entrega</label>
            <span className="text-[10px] text-zinc-500">Cole o texto do iFood aqui</span>
          </div>
          <input
            type="text"
            placeholder="Rua, Número, Bairro"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onPaste={handleAddressPaste}
            className="h-14 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-zinc-400">Link do Maps</label>
          <input
            type="url"
            placeholder="https://maps.google.com/..."
            value={mapsLink}
            onChange={(e) => setMapsLink(e.target.value)}
            className="h-14 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-2 border-t border-zinc-800 pt-4">
          <label className="text-sm font-semibold text-zinc-400">Forma de Pagamento</label>
          <select 
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as any)}
            className="h-14 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 text-zinc-100 focus:border-emerald-500 focus:outline-none"
          >
            <option value="dinheiro">Dinheiro</option>
            <option value="pix">Pix</option>
            <option value="cartao_credito">Cartão de Crédito</option>
            <option value="cartao_debito">Cartão de Débito</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <input 
            type="checkbox" 
            id="isPaid"
            checked={isPaid}
            onChange={(e) => setIsPaid(e.target.checked)}
            className="h-6 w-6 rounded-md accent-emerald-500"
          />
          <label htmlFor="isPaid" className="font-semibold text-zinc-200">Pedido já está pago?</label>
        </div>

        {paymentMethod === 'dinheiro' && !isPaid && (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-zinc-400">Troco para (R$)</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="0,00"
              value={changeFor}
              onChange={(e) => setChangeFor(formatCurrencyInput(e.target.value))}
              className="h-14 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
            />
          </div>
        )}

        <div className="flex flex-col gap-2 border-t border-zinc-800 pt-4">
          <label className="text-sm font-semibold text-zinc-400">Bebidas (Opcional)</label>
          <input
            type="text"
            placeholder="Ex: 1 Coca 2L"
            value={drinks}
            onChange={(e) => setDrinks(e.target.value)}
            className="h-14 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        {/* CAMPOS OPCIONAIS E SECUNDÁRIOS */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-zinc-400">Cód. Confirmação</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Ex: 1234"
              maxLength={4}
              value={confirmationCode}
              onChange={(e) => setConfirmationCode(e.target.value.replace(/\D/g, ''))} // Só aceita números
              className="h-14 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-zinc-400">Observação</label>
            <input
              type="text"
              placeholder="Ex: Portão azul"
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              className="h-14 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        <button
          type="submit"
          className="mt-6 h-14 w-full rounded-2xl bg-amber-500 font-bold text-zinc-950 active:scale-[0.98]"
        >
          Salvar Entrega
        </button>
      </form>
    </div>
  );
}
