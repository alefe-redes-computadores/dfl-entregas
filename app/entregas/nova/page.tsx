'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ChevronLeft, Store, Smartphone, Banknote, QrCode, CreditCard, 
  ChevronDown, AlertTriangle, Navigation, CheckCircle2, Link2, MessageCircle, Info, Sparkles, ClipboardPaste
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/useAppStore';
import { CustomerAutocomplete } from '@/components/deliveries/CustomerAutocomplete';
import { AddressAutocomplete } from '@/components/deliveries/AddressAutocomplete'; 
import { extractCoordinatesFromUrl } from '@/lib/maps';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import type { Delivery, OrderOrigin, Customer } from '@/types';

export default function NovaEntregaPage() {
  const router = useRouter();
  const routes = useAppStore((state) => state.routes);
  const customers = useAppStore((state) => state.customers);
  const addDelivery = useAppStore((state) => state.addDelivery);
  const findOrCreateCustomer = useAppStore((state) => state.findOrCreateCustomer);

  const openRoutes = routes.filter(r => r.status === 'aberta');

  const [magicText, setMagicText] = useState('');

  const [origin, setOrigin] = useState<OrderOrigin>('ifood');
  const [routeId, setRouteId] = useState('');
  const [isRouteDropdownOpen, setIsRouteDropdownOpen] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [ifoodId, setIfoodId] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');

  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(false);

  const [streetAddress, setStreetAddress] = useState('');
  const [mapsLink, setMapsLink] = useState('');

  const [value, setValue] = useState(''); 
  const [paymentMethod, setPaymentMethod] = useState<Delivery['payment_method']>('dinheiro');
  const [isPaid, setIsPaid] = useState(false);
  const [changeFor, setChangeFor] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [drinks, setDrinks] = useState('');
  const [observation, setObservation] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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

  // PARSER MÁGICO DE ALTA PRECISÃO
  const handleExecuteMagicParse = async () => {
    if (!magicText.trim()) {
      toast.error('Cole o texto do pedido antes de processar.');
      return;
    }

    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Medium });

    let foundOrderId = '';
    let foundIfoodId = '';
    let foundConfirmationCode = '';
    let foundCustomerName = '';
    let foundPhone = '';
    let foundAddress = '';
    let foundMapsLink = '';
    let foundPaid = false;
    let foundMethod: Delivery['payment_method'] | null = null;
    let foundValue = '';
    let foundChangeFor = '';
    let foundDrinks: string[] = [];
    let foundObs: string[] = [];

    const rawLines = magicText.split('\n').map(l => l.trim()).filter(Boolean);
    let idLineIndex = -1;

    // 1ª PASSADA: IDENTIFICADORES, MAPS E LINKS
    rawLines.forEach((line, idx) => {
      const lower = line.toLowerCase();

      // Maps
      const urlMatch = line.match(/https?:\/\/[^\s]+/i);
      if (urlMatch && (urlMatch[0].includes('maps') || urlMatch[0].includes('goo.gl'))) {
        foundMapsLink = urlMatch[0];
        return;
      }

      // Linha de Números/IDs
      const tokens = line.replace(/\D+/g, ' ').trim().split(' ').filter(Boolean);
      const isHeaderLine = tokens.length > 0 && !lower.includes('r.') && !lower.includes('rua') && !lower.includes('av') && !lower.includes('pago') && !lower.includes('total');
      
      if (isHeaderLine && tokens.some(t => t.length === 8)) {
        idLineIndex = idx;
        tokens.forEach(tok => {
          if ((tok.length === 4 || tok.length === 5) && !foundOrderId) {
            foundOrderId = tok;
          } else if (tok.length === 8 && !foundIfoodId) {
            foundIfoodId = tok;
          } else if (tok.length === 4 && foundIfoodId && !foundConfirmationCode) {
            foundConfirmationCode = tok;
          }
        });
      }
    });

    // 2ª PASSADA: ANÁLISE LINHA A LINHA
    rawLines.forEach((line, idx) => {
      const lower = line.toLowerCase();

      // Pula a linha que já foi processada como IDs ou Link
      if (idx === idLineIndex || line.startsWith('http')) return;

      // Nome do Cliente por padrão de linha
      if (lower.startsWith('cliente:') || lower.startsWith('nome:')) {
        foundCustomerName = line.replace(/^(cliente|nome):\s*/i, '').trim();
        return;
      }

      // Nome posicional (linha de texto após o ID)
      if (!foundCustomerName && idLineIndex !== -1 && idx > idLineIndex && idx <= idLineIndex + 2) {
        const isNotAddress = !lower.includes('r.') && !lower.includes('rua') && !lower.includes('av') && !lower.includes('cep');
        const isNotMoney = !lower.includes('pago') && !lower.includes('cart') && !lower.includes('dinheiro') && !/\d+[.,]\d{2}/.test(line);
        if (isNotAddress && isNotMoney && line.length > 2) {
          foundCustomerName = line.replace(/[-•*]/g, '').trim();
          return;
        }
      }

      // Telefone
      const phoneMatch = line.match(/(?:\(?\d{2}\)?\s*)?(?:9\s*)?\d{4,5}[-\s]?\d{4}/);
      if (phoneMatch && !foundPhone && !lower.includes('cep')) {
        const digits = phoneMatch[0].replace(/\D/g, '');
        if (digits.length >= 10 && digits.length <= 11) foundPhone = digits;
      }

      // Bebidas com volumes
      const isDrink = /(coca|guaraná|guarana|fanta|sprite|suco|refrigerante|cerveja|heineken|água|agua|schweppes|del valle)/i.test(lower);
      const hasVolume = /(\d+\s*(?:l|ml|litro|litros)|lata|garrafa|600ml|2l|1\.5l|350ml)/i.test(lower);
      if (isDrink || (hasVolume && !lower.includes('r.') && !lower.includes('ap'))) {
        foundDrinks.push(line.replace(/^[-•*x\d\s]+\s*/i, '').trim());
        return;
      }

      // Financeiro e Formas de Pagamento
      if (lower.includes('pago') || lower.includes('pago no app') || lower.includes('pago online')) {
        foundPaid = true;
        foundMethod = 'pix';
      }

      if (lower.includes('cartão') || lower.includes('cartao') || lower.includes('crédito') || lower.includes('debito')) {
        foundMethod = 'cartao';
        foundPaid = false;
      }

      if (lower.includes('dinheiro') || lower.includes('troco') || lower.includes('voltar')) {
        foundMethod = 'dinheiro';
        foundPaid = false;
      }

      // Valores
      const valMatch = line.match(/(?:r\$\s*)?(\d+[.,]\d{2})/i);
      if (valMatch && !foundValue && !lower.includes('troco') && !lower.includes('voltar')) {
        foundValue = valMatch[1].replace('.', ',');
      }

      const trocoMatch = line.match(/troco\s*(?:para|p\/)?\s*(?:r\$\s*)?(\d+[.,]?\d*)/i);
      const voltarMatch = line.match(/voltar\s*(?:r\$\s*)?(\d+[.,]?\d*)/i);
      if (trocoMatch) {
        foundChangeFor = trocoMatch[1].replace('.', ',');
      } else if (voltarMatch && valMatch) {
        const vBase = parseFloat(valMatch[1].replace(',', '.'));
        const vVolta = parseFloat(voltarMatch[1].replace(',', '.'));
        if (!isNaN(vBase) && !isNaN(vVolta)) {
          foundChangeFor = (vBase + vVolta).toFixed(2).replace('.', ',');
        }
      }

      // Endereço e Observações
      if (lower.includes('r.') || lower.includes('rua') || lower.includes('av.') || lower.includes('avenida') || lower.includes('alameda') || lower.includes('travessa') || lower.includes('cep')) {
        let clean = line
          .replace(/,\s*Patos de Minas(?:\s*\/\s*MG|\s*-\s*MG)?/gi, '')
          .replace(/-\s*CEP\s*[\d-]+/gi, '')
          .replace(/CEP\s*[\d-]+/gi, '')
          .trim();

        // Une número e bloco/letra (ex: 41 - C vira 41C)
        clean = clean.replace(/(\b\d+)\s*-\s*([a-zA-Z]\b)/g, '$1$2');

        // Extrai dados de apartamento ou bloco para a observação
        const aptoMatch = clean.match(/(?:ap|apto|apartamento|bloco)\s*[\w\d]+/i);
        if (aptoMatch) {
          foundObs.push(aptoMatch[0].trim());
          clean = clean.replace(aptoMatch[0], '').trim();
        }

        // Extrai observações adicionais no final da linha (ex: - Casa Azul, - Rua Do Posto)
        const parts = clean.split(/\s*-\s*/);
        if (parts.length > 2) {
          const possibleObs = parts[parts.length - 1].trim();
          const lowerObs = possibleObs.toLowerCase();
          
          if (!lowerObs.includes('bairro') && !lowerObs.includes('vila') && !lowerObs.includes('jardim')) {
            if (lowerObs === 'casa') {
              // Apenas remove a palavra genérica 'casa'
              parts.pop();
            } else {
              foundObs.push(possibleObs);
              parts.pop();
            }
            clean = parts.join(' - ');
          }
        }

        // Limpeza de 'Casa' no meio da linha
        clean = clean.replace(/\s*-\s*casa\s*-\s*/gi, ' - ').replace(/,\s*casa\s*,/gi, ', ');

        foundAddress = clean.replace(/\s*-\s*$/, '').replace(/,\s*,/g, ',').trim();
        return;
      }

      // Observações explícitas
      if (lower.includes('obs:') || lower.includes('observação:') || lower.includes('observacao:')) {
        foundObs.push(line.replace(/^(?:obs|observação|observacao):\s*/i, '').trim());
      }
    });

    const identified: string[] = [];
    if (foundOrderId) { setOrderId(foundOrderId); identified.push(`Nº #${foundOrderId}`); }
    if (foundIfoodId) { setIfoodId(foundIfoodId); identified.push(`ID ${foundIfoodId}`); }
    if (foundConfirmationCode) { setConfirmationCode(foundConfirmationCode); identified.push(`Cód. ${foundConfirmationCode}`); }
    if (foundCustomerName) { setCustomerName(foundCustomerName); identified.push('Cliente'); }
    if (foundPhone) { setPhone(formatPhoneInput(foundPhone)); identified.push('Zap'); }
    if (foundAddress) { setStreetAddress(foundAddress); identified.push('Endereço'); }
    if (foundMapsLink) { setMapsLink(foundMapsLink); identified.push('Link Maps'); }
    if (foundPaid) { setIsPaid(true); identified.push('Pago (Pix)'); }
    if (foundMethod) { setPaymentMethod(foundMethod); }
    if (foundValue) { setValue(formatCurrencyInput(foundValue.replace(/\D/g, ''))); identified.push(`Valor R$ ${foundValue}`); }
    if (foundChangeFor) { setChangeFor(formatCurrencyInput(foundChangeFor.replace(/\D/g, ''))); identified.push(`Troco p/ ${foundChangeFor}`); }
    if (foundDrinks.length > 0) { setDrinks(foundDrinks.join(', ')); identified.push('Bebidas'); }
    if (foundObs.length > 0) {
      setObservation(prev => prev ? `${prev}, ${foundObs.join(' - ')}` : foundObs.join(' - '));
      identified.push('Obs');
    }

    if (identified.length > 0) {
      if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Heavy });
      toast.success('Auto-Preenchido com Sucesso! 🪄', {
        description: `Detectados: ${identified.join(' • ')}`,
        duration: 4000
      });
      setMagicText('');
    } else {
      toast.error('Nenhum dado reconhecido no texto.');
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setMagicText(text);
        toast.info('Texto colado! Clique em "Auto-Preencher" para processar.');
      }
    } catch {
      toast.error('Cole o texto manualmente na caixa.');
    }
  };

  const addressAudit = useMemo(() => {
    const coords = extractCoordinatesFromUrl(mapsLink);
    if (coords || (mapsLink && mapsLink.includes('http'))) {
      return {
        status: 'precise' as const,
        title: 'Localização 100% Precisa',
        desc: 'Link do Maps identificado com sucesso.'
      };
    }
    const hasNumber = /\d+/.test(streetAddress);
    if (streetAddress.trim().length > 3 && hasNumber) {
      return {
        status: 'good' as const,
        title: 'Endereço com Número',
        desc: 'Rua e número prontos para entrega.'
      };
    }
    if (streetAddress.trim().length > 0 && !hasNumber) {
      return {
        status: 'warning' as const,
        title: 'Atenção: Sem Número!',
        desc: 'Cole o link do Maps para evitar erros de rota.'
      };
    }
    return null;
  }, [streetAddress, mapsLink]);

  const handleCustomerSelect = (c: Customer) => {
    setCustomerName(c.name);
    if (c.address) setStreetAddress(c.address);
    if (c.phone) setPhone(formatPhoneInput(c.phone));
    if (c.observation) setObservation(c.observation);
    if (c.maps_link) setMapsLink(c.maps_link);
    if (c.last_confirmation_code) setConfirmationCode(c.last_confirmation_code);
    toast.success('Cliente carregado! 🪄');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routeId || !value || !streetAddress) {
      toast.error('Preencha os campos obrigatórios (Rota, Valor e Rua)');
      return;
    }
    
    if (origin === 'ifood') {
      if (!orderId) {
        toast.error('Pedidos do iFood exigem o Número do Pedido.');
        return;
      }
      if (confirmationCode && confirmationCode.length !== 4) {
        toast.error('Código Inválido', { description: 'Deve conter exatamente 4 dígitos.' });
        return;
      }
      if (ifoodId && ifoodId.length !== 8) {
        toast.error('ID Inválido', { description: 'Deve conter exatamente 8 dígitos.' });
        return;
      }
    }

    setIsSaving(true);
    try {
      const cleanValue = parseFloat(value.replace(/\./g, '').replace(',', '.'));
      const cleanChangeFor = changeFor ? parseFloat(changeFor.replace(/\./g, '').replace(',', '.')) : undefined;
      const cleanStreet = streetAddress.trim().replace(/[,|-]\s*$/, '');
      const rawPhone = phone.replace(/\D/g, '');

      let customerId: string | undefined = undefined;
      if (customerName.trim()) {
        customerId = await findOrCreateCustomer(customerName, {
          address: cleanStreet,
          phone: rawPhone || undefined,
          mapsLink,
          confirmationCode: origin === 'ifood' ? confirmationCode : undefined,
          observation,
          origin,
        });
      }

      const now = new Date().toISOString();
      const novaEntrega: Delivery = {
        id: Date.now().toString(),
        route_id: routeId,
        origin,
        order_id: origin === 'ifood' ? (orderId || undefined) : undefined,
        ifood_id: origin === 'ifood' ? (ifoodId || undefined) : undefined,
        confirmation_code: origin === 'ifood' ? (confirmationCode || undefined) : undefined,
        customer_id: customerId || '',
        customer_name: customerName.trim() || undefined,
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
        createdAt: now,
        created_at: now,
        updated_at: now,
      };

      await addDelivery(novaEntrega);
      toast.success('Entrega cadastrada com sucesso!');
      router.push('/');
    } catch (error) {
      console.error('Erro ao cadastrar entrega:', error);
      toast.error('Não foi possível cadastrar a entrega.', {
        description: 'Confira sua conexão e tente novamente.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (openRoutes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center px-4">
        <p className="text-zinc-400">Abra uma rota primeiro para registrar entregas.</p>
        <button onClick={() => router.push('/rotas/nova')} className="rounded-xl bg-emerald-500 px-6 py-3 font-bold text-zinc-950">
          Criar Rota Agora
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 relative">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/')} className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-zinc-400 active:scale-95">
          <ChevronLeft size={22} />
        </button>
        <h1 className="font-heading text-xl font-bold text-zinc-50">Nova Entrega</h1>
      </div>

      {/* SELETOR DE ORIGEM (iFood vs Loja Própria) */}
      <div className="flex gap-2 p-1 bg-zinc-900 rounded-2xl border border-zinc-800">
        <button 
          type="button" 
          onClick={() => setOrigin('ifood')} 
          className={`flex-1 flex items-center justify-center gap-2 h-12 rounded-xl font-bold transition-all ${origin === 'ifood' ? 'bg-red-500 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <Smartphone size={18} /> iFood
        </button>
        <button 
          type="button" 
          onClick={() => {
            setOrigin('loja');
            setOrderId('');
            setIfoodId('');
            setConfirmationCode('');
            setMagicText('');
          }} 
          className={`flex-1 flex items-center justify-center gap-2 h-12 rounded-xl font-bold transition-all ${origin === 'loja' ? 'bg-emerald-500 text-zinc-950 shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <Store size={18} /> Loja Própria
        </button>
      </div>

      {/* CAIXA DE TEXTO DO PARSER (APENAS QUANDO FOR IFOOD) */}
      {origin === 'ifood' && (
        <div className="flex flex-col gap-2.5 p-4 bg-gradient-to-b from-red-500/10 to-zinc-900/40 border border-red-500/20 rounded-[24px] animate-in fade-in">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-red-400 flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-400" /> Parser de Texto iFood
            </span>
            <button 
              type="button" 
              onClick={handlePasteFromClipboard}
              className="flex items-center gap-1 text-[11px] font-bold text-zinc-300 bg-zinc-800/90 hover:bg-zinc-700 px-3 py-1 rounded-full active:scale-95 transition-all shadow-sm"
            >
              <ClipboardPaste size={12} className="text-red-400" /> Colar do Celular
            </button>
          </div>
          
          <textarea
            rows={3}
            placeholder="Cole aqui o texto do iFood..."
            value={magicText}
            onChange={(e) => setMagicText(e.target.value)}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950/80 p-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-red-500/50 outline-none resize-none font-mono"
          />

          <button
            type="button"
            onClick={handleExecuteMagicParse}
            className="h-11 w-full rounded-xl bg-red-500 hover:bg-red-400 font-bold text-white text-xs flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-red-500/20"
          >
            <Sparkles size={15} /> Auto-Preencher Campos
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5 pb-10">
        
        {/* ROTA */}
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
                  {openRoutes.find(r => r.id === routeId)?.name} <span className="text-zinc-400 font-normal">({openRoutes.find(r => r.id === routeId)?.motoboy_name})</span>
                </span>
              ) : 'Selecione a rota...'}
            </span>
            <ChevronDown size={20} className={`text-zinc-500 transition-transform ${isRouteDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isRouteDropdownOpen && <div className="fixed inset-0 z-20" onClick={() => setIsRouteDropdownOpen(false)} />}

          {isRouteDropdownOpen && (
            <div className="absolute top-[84px] z-30 flex max-h-56 w-full flex-col overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
              {openRoutes.map(r => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => { setRouteId(r.id); setIsRouteDropdownOpen(false); }}
                  className="flex items-center justify-between px-4 py-4 text-left text-sm active:bg-zinc-800 border-b border-zinc-800/50 last:border-0"
                >
                  <span className={`font-semibold ${routeId === r.id ? 'text-emerald-500' : 'text-zinc-200'}`}>
                    {r.name} <span className={routeId === r.id ? 'text-emerald-500/70' : 'text-zinc-500 font-normal'}>({r.motoboy_name})</span>
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
              <label className="text-xs font-bold text-emerald-400">Nº Pedido*</label>
              <input 
                type="text" 
                inputMode="numeric" 
                placeholder="Ex: 5463" 
                maxLength={5} 
                value={orderId} 
                onChange={(e) => setOrderId(e.target.value.replace(/\D/g, ''))} 
                className="h-12 rounded-xl border-2 border-emerald-500/50 bg-zinc-900/80 px-3 text-base font-bold text-zinc-50 focus:border-emerald-500 focus:outline-none" 
                required 
              />
            </div>
            <div className="flex flex-col gap-1.5 relative">
              <div className="flex items-center justify-between px-1">
                <label className="text-[11px] font-semibold text-zinc-400">ID Pedido</label>
                <button type="button" onClick={() => toast.info('ID do Pedido: 8 dígitos do iFood')} className="text-zinc-500 hover:text-sky-400"><Info size={12} /></button>
              </div>
              <input 
                type="text" 
                inputMode="numeric" 
                placeholder="Ex: 60873228" 
                maxLength={8}
                value={ifoodId} 
                onChange={(e) => setIfoodId(e.target.value.replace(/\D/g, ''))} 
                className={`h-12 rounded-xl border bg-zinc-900/50 px-3 text-sm text-zinc-100 focus:outline-none ${ifoodId.length > 0 && ifoodId.length < 8 ? 'border-amber-500' : 'border-zinc-800 focus:border-emerald-500'}`} 
              />
            </div>
            <div className="flex flex-col gap-1.5 relative">
              <div className="flex items-center justify-between px-1">
                <label className="text-[11px] font-semibold text-zinc-400">Cód. Confirmação</label>
                <button type="button" onClick={() => toast.info('Código: 4 dígitos informados pelo cliente')} className="text-zinc-500 hover:text-sky-400"><Info size={12} /></button>
              </div>
              <input 
                type="text" 
                inputMode="numeric" 
                placeholder="Ex: 1234" 
                maxLength={4} 
                value={confirmationCode} 
                onChange={(e) => setConfirmationCode(e.target.value.replace(/\D/g, ''))} 
                className={`h-12 rounded-xl border bg-zinc-900/50 px-3 text-sm text-zinc-100 font-mono font-bold tracking-widest focus:outline-none ${confirmationCode.length > 0 && confirmationCode.length < 4 ? 'border-amber-500' : 'border-zinc-800 focus:border-emerald-500'}`} 
              />
            </div>
          </div>
        )}

        {/* CLIENTE E WHATSAPP */}
        <div className="flex flex-col gap-3 border-t border-zinc-800 pt-4">
          <CustomerAutocomplete value={customerName} onChange={setCustomerName} onSelect={handleCustomerSelect} customers={customers} />
          
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
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setNotifyWhatsapp(!notifyWhatsapp);
              }}
              className={`flex items-center gap-1.5 h-12 px-4 rounded-xl border text-xs font-bold transition-all active:scale-95 shrink-0 ${
                notifyWhatsapp 
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-sm' 
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400'
              }`}
            >
              <MessageCircle size={15} /> Avisar no Zap
            </button>
          </div>
        </div>

        {/* ENDEREÇO E LINK MAPS */}
        <div className="flex flex-col gap-3 border-t border-zinc-800 pt-4">
          <AddressAutocomplete 
            value={streetAddress} 
            onChange={setStreetAddress} 
            placeholder="Ex: Rua Major Gote, 100, Bairro"
            label="Endereço da Entrega*"
          />

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
            <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1">
              <Link2 size={13} className="text-sky-400" /> Link Manual / Coordenadas (Opcional)
            </label>
            <input 
              type="text" 
              placeholder="Cole o link do Maps ou coordenadas @lat,lng" 
              value={mapsLink} 
              onChange={(e) => setMapsLink(e.target.value)} 
              className="h-12 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none" 
            />
          </div>
        </div>

        {/* FINANCEIRO E PRODUTOS */}
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
              <button type="button" onClick={() => setPaymentMethod('dinheiro')} className={`flex flex-col items-center justify-center gap-1.5 h-16 rounded-xl border-2 transition-all ${paymentMethod === 'dinheiro' ? 'border-amber-500 bg-amber-500/10 text-amber-500' : 'border-zinc-800 bg-zinc-900/50 text-zinc-400'}`}>
                <Banknote size={20} />
                <span className="text-xs font-bold">Dinheiro</span>
              </button>
              <button type="button" onClick={() => setPaymentMethod('pix')} className={`flex flex-col items-center justify-center gap-1.5 h-16 rounded-xl border-2 transition-all ${paymentMethod === 'pix' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500' : 'border-zinc-800 bg-zinc-900/50 text-zinc-400'}`}>
                <QrCode size={20} />
                <span className="text-xs font-bold">Pix</span>
              </button>
              <button type="button" onClick={() => { setPaymentMethod('cartao'); setIsPaid(false); }} className={`flex flex-col items-center justify-center gap-1.5 h-16 rounded-xl border-2 transition-all ${(paymentMethod as string) === 'cartao' ? 'border-sky-500 bg-sky-500/10 text-sky-500' : 'border-zinc-800 bg-zinc-900/50 text-zinc-400'}`}>
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
            <label className="text-xs font-semibold text-zinc-400">Observação / Portão / Complemento</label>
            <input type="text" placeholder="Ex: Ap. 11B, Portão preto..." value={observation} onChange={(e) => setObservation(e.target.value)} className="h-12 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none" />
          </div>

          <div className={`flex items-center justify-between p-3.5 rounded-xl transition-all border ${isUrgent ? 'bg-red-500/10 border-red-500/30' : 'bg-zinc-900/50 border-zinc-800'}`}>
            <div className="flex flex-col">
              <span className={`text-xs font-bold flex items-center gap-1.5 ${isUrgent ? 'text-red-400' : 'text-zinc-300'}`}>
                <AlertTriangle size={15} className={isUrgent ? "text-red-500" : "text-zinc-500"} /> Entrega Urgente?
              </span>
              <span className="text-[10px] text-zinc-500">Prioridade na rota</span>
            </div>
            <button type="button" onClick={() => setIsUrgent(!isUrgent)} className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 ${isUrgent ? 'bg-red-500' : 'bg-zinc-700'}`}>
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ${isUrgent ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        <button type="submit" disabled={isSaving} className="mt-2 h-14 w-full rounded-2xl bg-amber-500 font-bold text-zinc-950 active:scale-[0.98] disabled:opacity-60 shadow-lg shadow-amber-500/20 transition-all">
          {isSaving ? 'Salvando...' : 'Salvar Entrega'}
        </button>
      </form>
    </div>
  );
}
