'use client';

import { useState, useMemo } from 'react';
import { 
  Users, UserPlus, Calculator, PlusCircle, Trash2, ShieldCheck, 
  CheckCircle2, Package, Wallet, TrendingUp, CalendarDays, Receipt, X, Send, Settings, Check
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import type { Motoboy, MotoboyPaymentRule, PaymentRuleType } from '@/types';

type TabType = 'acerto' | 'config';

interface ValeItem {
  id: string;
  description: string;
  amount: number;
}

// Utilitário para Máscara de Moeda em Reais (R$)
const formatCurrencyInput = (value: string): string => {
  const numbers = value.replace(/\D/g, '');
  if (!numbers) return '';
  const amount = Number(numbers) / 100;
  return amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const parseCurrencyToNumber = (formattedValue: string): number => {
  if (!formattedValue) return 0;
  const numbers = formattedValue.replace(/\D/g, '');
  return Number(numbers) / 100;
};

export default function MotoboysPage() {
  const motoboys = useAppStore(state => state.motoboys);
  const routes = useAppStore(state => state.routes);
  const deliveries = useAppStore(state => state.deliveries);
  const addMotoboy = useAppStore(state => state.addMotoboy);
  const updateMotoboy = useAppStore(state => state.updateMotoboy);

  // Estados Gerais
  const [isAdding, setIsAdding] = useState(false);
  const [newMotoboyName, setNewMotoboyName] = useState('');
  const [newMotoboyType, setNewMotoboyType] = useState<'fixo' | 'avulso'>('fixo');
  
  const [selectedMotoboy, setSelectedMotoboy] = useState<Motoboy & { type?: 'fixo' | 'avulso' } | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('acerto');

  // Estados do Modal de Acerto (Data local sem bugs de fuso)
  const [acertoDate, setAcertoDate] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  const [vales, setVales] = useState<ValeItem[]>([]);
  const [valeDesc, setValeDesc] = useState('');
  const [valeAmount, setValeAmount] = useState('');

  // Estados de Configuração (Regras com Máscara)
  const [ruleType, setRuleType] = useState<PaymentRuleType>('fixed_plus_variable');
  const [ruleFixedAmount, setRuleFixedAmount] = useState('');
  const [ruleDeliveryFee, setRuleDeliveryFee] = useState('');
  const [ruleThreshold, setRuleThreshold] = useState('');
  const [ruleExtraFee, setRuleExtraFee] = useState('');
  const [editType, setEditType] = useState<'fixo' | 'avulso'>('fixo');

  // ------------------------------------------------------------------
  // LISTAGEM & ORDENAÇÃO
  // ------------------------------------------------------------------
  const sortedMotoboys = useMemo(() => {
    return [...motoboys].sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [motoboys]);

  // ------------------------------------------------------------------
  // AÇÕES BÁSICAS
  // ------------------------------------------------------------------
  const handleAddMotoboy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMotoboyName.trim()) return;
    
    const newM: Motoboy & { type?: 'fixo' | 'avulso' } = {
      id: Date.now().toString(),
      name: newMotoboyName.trim(),
      active: true,
      type: newMotoboyType,
      payment_rule: {
        type: 'fixed_plus_variable',
        fixed_amount: 100,
        threshold: 15,
        extra_fee: 7
      }
    };
    await addMotoboy(newM as Motoboy);
    setNewMotoboyName('');
    setIsAdding(false);
    toast.success('Motoboy cadastrado com sucesso!');
  };

  const openMotoboyPanel = (m: Motoboy & { type?: 'fixo' | 'avulso' }) => {
    setSelectedMotoboy(m);
    setActiveTab('acerto');
    setVales([]);
    setEditType(m.type || 'fixo');
    
    const rule = m.payment_rule || { type: 'fixed_plus_variable', fixed_amount: 100, threshold: 15, extra_fee: 7 };
    setRuleType(rule.type);
    setRuleFixedAmount(rule.fixed_amount ? (rule.fixed_amount * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '');
    setRuleDeliveryFee(rule.delivery_fee ? (rule.delivery_fee * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '');
    setRuleThreshold(rule.threshold?.toString() || '');
    setRuleExtraFee(rule.extra_fee ? (rule.extra_fee * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '');
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMotoboy) return;

    const newRule: MotoboyPaymentRule = {
      type: ruleType,
      fixed_amount: parseCurrencyToNumber(ruleFixedAmount),
      delivery_fee: parseCurrencyToNumber(ruleDeliveryFee),
      threshold: Number(ruleThreshold) || 0,
      extra_fee: parseCurrencyToNumber(ruleExtraFee),
    };

    await updateMotoboy(selectedMotoboy.id, { 
      payment_rule: newRule,
      type: editType 
    } as any);

    toast.success('Configurações atualizadas com sucesso!');
    setSelectedMotoboy(null);
  };

  const toggleActive = async () => {
    if (!selectedMotoboy) return;
    const newStatus = !selectedMotoboy.active;
    await updateMotoboy(selectedMotoboy.id, { active: newStatus });
    setSelectedMotoboy({ ...selectedMotoboy, active: newStatus });
    toast.success(newStatus ? 'Motoboy ativado!' : 'Motoboy desativado!');
  };

  // ------------------------------------------------------------------
  // MÁQUINA DE CALCULAR ACERTO (CORRIGIDA PARA COMPARAÇÃO EXATA DE DATA)
  // ------------------------------------------------------------------
  const acertoData = useMemo(() => {
    if (!selectedMotoboy) return null;
    
    // Filtro robusto de rotas por data local estrita (evita bugs de fuso no dia 25/26)
    const todaysRoutes = routes.filter(r => {
      const isSameMotoboy = r.motoboy_name.toLowerCase().trim() === selectedMotoboy.name.toLowerCase().trim();
      const rawDate = r.started_at || r.departure_time || Date.now();
      const dateObj = new Date(rawDate);
      
      const rDateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
      
      return isSameMotoboy && rDateStr === acertoDate;
    });

    const todaysDeliveries = deliveries.filter(d => todaysRoutes.some(r => r.id === d.route_id));
    
    const totalDeliveries = todaysDeliveries.length;
    const deliveriesRevenue = todaysDeliveries.reduce((acc, curr) => acc + (curr.value || 0), 0);

    const rule = selectedMotoboy.payment_rule || { type: 'fixed_plus_variable', fixed_amount: 100, threshold: 15, extra_fee: 7 };
    let calculatedAmount = 0;
    let calculationDesc = '';

    if (rule.type === 'fixed') {
      calculatedAmount = rule.fixed_amount || 0;
      calculationDesc = `Taxa Fixa Diária: R$ ${(rule.fixed_amount || 0).toFixed(2)}`;
    } 
    else if (rule.type === 'per_delivery') {
      calculatedAmount = totalDeliveries * (rule.delivery_fee || 0);
      calculationDesc = `${totalDeliveries} entregas x R$ ${(rule.delivery_fee || 0).toFixed(2)}`;
    } 
    else if (rule.type === 'fixed_plus_variable') {
      const fixed = rule.fixed_amount || 0;
      const threshold = rule.threshold || 0;
      const extraFee = rule.extra_fee || 0;

      if (totalDeliveries <= threshold) {
        calculatedAmount = fixed;
        calculationDesc = `Até ${threshold} entregas: R$ ${fixed.toFixed(2)}`;
      } else {
        const extraDeliveries = totalDeliveries - threshold;
        const extraAmount = extraDeliveries * extraFee;
        calculatedAmount = fixed + extraAmount;
        calculationDesc = `Base R$ ${fixed.toFixed(2)} + ${extraDeliveries} extra(s) x R$ ${extraFee.toFixed(2)}`;
      }
    }

    const totalVales = vales.reduce((acc, curr) => acc + curr.amount, 0);
    const finalAmountToPay = calculatedAmount - totalVales;

    return {
      totalDeliveries,
      deliveriesRevenue,
      calculatedAmount,
      calculationDesc,
      totalVales,
      finalAmountToPay
    };
  }, [selectedMotoboy, acertoDate, routes, deliveries, vales]);

  const handleCopyWhatsApp = async () => {
    if (!selectedMotoboy || !acertoData) return;

    const [year, month, day] = acertoDate.split('-');
    const formattedDate = `${day}/${month}/${year}`;
    
    let text = `🏍️ *ACERTO DIÁRIO | DFL ENTREGAS* 🏍️\n`;
    text += `👤 *Motoboy:* ${selectedMotoboy.name}\n`;
    text += `📅 *Data:* ${formattedDate}\n\n`;
    
    text += `📦 *Entregas Realizadas:* ${acertoData.totalDeliveries}\n`;
    text += `💰 *Valor Bruto em Caixa:* R$ ${acertoData.deliveriesRevenue.toFixed(2).replace('.', ',')}\n\n`;

    text += `📈 *Cálculo do Repasse:*\n`;
    text += `   ↳ ${acertoData.calculationDesc} = *R$ ${acertoData.calculatedAmount.toFixed(2).replace('.', ',')}*\n\n`;

    if (vales.length > 0) {
      text += `➖ *Vales / Retenções / Caixas:*\n`;
      vales.forEach(v => {
        text += `   - ${v.description}: R$ ${v.amount.toFixed(2).replace('.', ',')}\n`;
      });
      text += `   *Total Abatido:* R$ ${acertoData.totalVales.toFixed(2).replace('.', ',')}\n\n`;
    }

    text += `💵 *TOTAL A RECEBER:* *R$ ${acertoData.finalAmountToPay.toFixed(2).replace('.', ',')}* 💵`;

    await navigator.clipboard.writeText(text);
    toast.success('Recibo copiado para o WhatsApp!', { description: 'Cole na conversa do motoboy.' });
  };

  const handleAddVale = () => {
    if (!valeDesc.trim() || !valeAmount) return toast.error('Preencha a descrição e o valor do vale');
    const amountNum = parseCurrencyToNumber(valeAmount);
    setVales([...vales, { id: Date.now().toString(), description: valeDesc, amount: amountNum }]);
    setValeDesc('');
    setValeAmount('');
  };

  return (
    <div className="flex flex-col gap-5 relative pb-24">
      
      {/* CABEÇALHO COM VOLTAR PARA A LOJA */}
      <PageHeader 
        title="Equipe de Motoboys" 
        subtitle="Gerencie frotas, regras e acertos" 
        to="/loja"
      />

      {!isAdding ? (
        <button onClick={() => setIsAdding(true)} className="flex items-center justify-center gap-2 bg-zinc-900/60 border border-dashed border-zinc-700 text-zinc-300 rounded-2xl p-4 font-bold hover:bg-zinc-800 transition-colors cursor-pointer">
          <UserPlus size={18} /> Adicionar Novo Motoboy
        </button>
      ) : (
        <div className="flex flex-col gap-3 p-4 bg-zinc-900 border border-zinc-800 rounded-2xl animate-in fade-in">
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Nome do motoboy..." 
              value={newMotoboyName} 
              onChange={(e) => setNewMotoboyName(e.target.value)} 
              className="flex-1 h-12 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-zinc-100 focus:border-sky-500 focus:outline-none text-sm" 
              autoFocus
            />
            {/* SELETOR CUSTOMIZADO SEM SELECT NATIVO */}
            <div className="flex bg-zinc-950 border border-zinc-800 rounded-xl p-1 shrink-0">
              <button 
                type="button" 
                onClick={() => setNewMotoboyType('fixo')}
                className={`px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${newMotoboyType === 'fixo' ? 'bg-sky-500 text-zinc-950' : 'text-zinc-400'}`}
              >
                Fixo
              </button>
              <button 
                type="button" 
                onClick={() => setNewMotoboyType('avulso')}
                className={`px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${newMotoboyType === 'avulso' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400'}`}
              >
                Avulso
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAddMotoboy} className="flex-1 h-11 rounded-xl bg-sky-500 text-zinc-950 font-bold text-sm hover:bg-sky-400 cursor-pointer">
              Salvar Motoboy
            </button>
            <button onClick={() => setIsAdding(false)} className="h-11 px-4 rounded-xl bg-zinc-800 text-zinc-400 text-sm hover:bg-zinc-700 cursor-pointer">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* LISTA DE MOTOBOYS */}
      <div className="flex flex-col gap-3">
        {sortedMotoboys.map(m => {
          const type = (m as any).type || 'fixo';
          return (
            <button 
              key={m.id} 
              onClick={() => openMotoboyPanel(m)}
              className={`flex items-center justify-between p-4 rounded-[24px] border border-zinc-800/80 transition-all cursor-pointer ${m.active ? 'bg-zinc-900/40 hover:bg-zinc-800/60' : 'bg-zinc-950/50 opacity-60 grayscale'}`}
            >
              <div className="flex items-center gap-3">
                <div className={`h-11 w-11 rounded-full flex items-center justify-center font-bold text-base ${m.active ? 'bg-sky-500/10 text-sky-500' : 'bg-zinc-800 text-zinc-500'}`}>
                  {m.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col items-start gap-1">
                  <span className="font-bold text-zinc-100 text-base">{m.name}</span>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${type === 'fixo' ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30' : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'}`}>
                      {type}
                    </span>
                    {!m.active && (
                      <span className="flex items-center gap-1 text-[10px] text-zinc-500 font-semibold">
                        <Users size={10} /> Inativo
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-semibold bg-zinc-800/60 px-3 py-2 rounded-xl">
                <Calculator size={14} className="text-emerald-400" /> Acerto
              </div>
            </button>
          );
        })}
      </div>

      {/* MODAL / PAINEL DO MOTOBOY */}
      {selectedMotoboy && (
        <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950/95 backdrop-blur-md animate-in fade-in duration-200">
          <div className="flex items-center justify-between p-4 border-b border-zinc-900 bg-zinc-950">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-sky-500/10 flex items-center justify-center text-sky-400 font-bold">
                {selectedMotoboy.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-lg font-black text-zinc-50">{selectedMotoboy.name}</h2>
                <p className="text-xs text-zinc-500">Central de Fechamento e Regras</p>
              </div>
            </div>
            <button onClick={() => setSelectedMotoboy(null)} className="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white cursor-pointer">
              <X size={20} />
            </button>
          </div>

          <div className="flex bg-zinc-900 p-1.5 border-b border-zinc-800">
            <button onClick={() => setActiveTab('acerto')} className={`flex-1 flex justify-center items-center gap-2 py-2.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${activeTab === 'acerto' ? 'bg-zinc-800 text-emerald-400 shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}>
              <Receipt size={14} /> Acerto Diário
            </button>
            <button onClick={() => setActiveTab('config')} className={`flex-1 flex justify-center items-center gap-2 py-2.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${activeTab === 'config' ? 'bg-zinc-800 text-sky-400 shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}>
              <Settings size={14} /> Regras & Tipo
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
            
            {/* --- ABA 1: ACERTO DIÁRIO --- */}
            {activeTab === 'acerto' && acertoData && (
              <div className="flex flex-col gap-4 animate-in slide-in-from-right-4">
                <div className="flex flex-col gap-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400">
                    <CalendarDays size={14} /> Data do Acerto
                  </label>
                  <div className="relative">
                    <input 
                      type="date" 
                      value={acertoDate} 
                      onChange={(e) => setAcertoDate(e.target.value)} 
                      className="w-full h-12 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 text-zinc-100 focus:border-emerald-500 font-bold text-sm outline-none" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-zinc-900/80 border border-zinc-800 p-3.5 rounded-2xl flex flex-col gap-1">
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 uppercase">
                      <Package size={12} className="text-emerald-500" /> Entregas no Dia
                    </span>
                    <span className="text-2xl font-black text-emerald-400">{acertoData.totalDeliveries}</span>
                  </div>
                  <div className="bg-zinc-900/80 border border-zinc-800 p-3.5 rounded-2xl flex flex-col gap-1">
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 uppercase">
                      <Wallet size={12} className="text-amber-500" /> Valor Bruto
                    </span>
                    <span className="text-2xl font-black text-amber-500">R$ {acertoData.deliveriesRevenue.toFixed(2).replace('.', ',')}</span>
                  </div>
                </div>

                <div className="bg-sky-500/5 border border-sky-500/20 p-4 rounded-2xl flex flex-col gap-1.5">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-sky-400 uppercase tracking-wider">
                    <TrendingUp size={12} /> Cálculo Automático
                  </span>
                  <p className="text-xs font-medium text-zinc-300">{acertoData.calculationDesc}</p>
                  <span className="text-xl font-black text-sky-400 mt-1">R$ {acertoData.calculatedAmount.toFixed(2).replace('.', ',')}</span>
                </div>

                <div className="border-t border-zinc-800 pt-4 flex flex-col gap-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Abatimentos / Vales (Opcional)</h3>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Ex: Lanche" 
                      value={valeDesc} 
                      onChange={(e)=>setValeDesc(e.target.value)} 
                      className="flex-[2] h-11 rounded-xl bg-zinc-900 border border-zinc-800 px-3 text-xs text-zinc-100 focus:border-red-500 outline-none" 
                    />
                    <input 
                      type="text" 
                      placeholder="R$ 0,00" 
                      value={valeAmount} 
                      onChange={(e)=>setValeAmount(formatCurrencyInput(e.target.value))} 
                      className="flex-1 h-11 rounded-xl bg-zinc-900 border border-zinc-800 px-3 text-xs text-zinc-100 focus:border-red-500 outline-none font-bold" 
                    />
                    <button onClick={handleAddVale} className="h-11 w-11 flex items-center justify-center bg-zinc-800 rounded-xl text-zinc-300 hover:bg-zinc-700 shrink-0 cursor-pointer"><PlusCircle size={18}/></button>
                  </div>

                  {vales.length > 0 && (
                    <div className="flex flex-col gap-2">
                      {vales.map(v => (
                        <div key={v.id} className="flex justify-between items-center bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl">
                          <span className="text-xs text-red-400 font-semibold">{v.description}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-red-400 font-bold">- R$ {v.amount.toFixed(2).replace('.', ',')}</span>
                            <button onClick={()=>setVales(vales.filter(x => x.id !== v.id))} className="text-red-500/50 hover:text-red-500 cursor-pointer"><Trash2 size={14}/></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Total Líquido a Pagar</span>
                    <span className="text-2xl font-black text-emerald-400 mt-0.5">R$ {acertoData.finalAmountToPay.toFixed(2).replace('.', ',')}</span>
                  </div>
                  <CheckCircle2 size={28} className="text-emerald-500/30" />
                </div>

                <button onClick={handleCopyWhatsApp} className="w-full flex items-center justify-center gap-2 h-14 bg-emerald-500 hover:bg-emerald-400 rounded-xl font-bold text-zinc-950 text-base shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer">
                  <Send size={18} /> Enviar Recibo WhatsApp
                </button>
              </div>
            )}

            {/* --- ABA 2: REGRAS E CONFIGURAÇÕES --- */}
            {activeTab === 'config' && (
              <form onSubmit={handleSaveConfig} className="flex flex-col gap-4 animate-in slide-in-from-left-4">
                
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-400">Tipo de Contratação (Etiqueta)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditType('fixo')}
                      className={`h-12 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${editType === 'fixo' ? 'bg-sky-500/15 border-sky-500 text-sky-400 shadow-md' : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}
                    >
                      {editType === 'fixo' && <Check size={14} />} Fixo
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditType('avulso')}
                      className={`h-12 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${editType === 'avulso' ? 'bg-amber-500/15 border-amber-500 text-amber-400 shadow-md' : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}
                    >
                      {editType === 'avulso' && <Check size={14} />} Avulso
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-400">Regra de Pagamento</label>
                  <div className="flex flex-col gap-2">
                    {[
                      { id: 'fixed_plus_variable', label: 'Fixo Mínimo + Taxa Extra' },
                      { id: 'per_delivery', label: 'Apenas por Entrega (Fixo)' },
                      { id: 'fixed', label: 'Apenas Diária Fixa' },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setRuleType(item.id as PaymentRuleType)}
                        className={`flex items-center justify-between p-3.5 rounded-xl border text-left font-semibold text-xs transition-all cursor-pointer ${ruleType === item.id ? 'bg-sky-500/10 border-sky-500 text-sky-400' : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}
                      >
                        {item.label}
                        {ruleType === item.id && <Check size={16} className="text-sky-400" />}
                      </button>
                    ))}
                  </div>
                </div>

                {ruleType === 'fixed_plus_variable' && (
                  <div className="grid grid-cols-2 gap-3 bg-zinc-900 p-3.5 rounded-xl border border-zinc-800">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Valor Fixo (R$)</label>
                      <input 
                        type="text" 
                        value={ruleFixedAmount} 
                        onChange={e => setRuleFixedAmount(formatCurrencyInput(e.target.value))} 
                        placeholder="R$ 0,00" 
                        className="h-11 rounded-lg bg-zinc-950 border border-zinc-800 px-3 text-zinc-100 text-sm font-bold focus:border-sky-500 outline-none" 
                        required 
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Até Quantas?</label>
                      <input 
                        type="number" 
                        value={ruleThreshold} 
                        onChange={e => setRuleThreshold(e.target.value)} 
                        placeholder="Ex: 15" 
                        className="h-11 rounded-lg bg-zinc-950 border border-zinc-800 px-3 text-zinc-100 text-sm font-bold focus:border-sky-500 outline-none" 
                        required 
                      />
                    </div>
                    <div className="flex flex-col gap-1 col-span-2 border-t border-zinc-800 pt-2.5">
                      <label className="text-[10px] font-bold text-sky-400 uppercase">Taxa por entrega extra (R$)</label>
                      <input 
                        type="text" 
                        value={ruleExtraFee} 
                        onChange={e => setRuleExtraFee(formatCurrencyInput(e.target.value))} 
                        placeholder="R$ 0,00" 
                        className="h-11 rounded-lg bg-zinc-950 border border-zinc-800 px-3 text-zinc-100 text-sm font-bold focus:border-sky-500 outline-none" 
                        required 
                      />
                    </div>
                  </div>
                )}

                {ruleType === 'per_delivery' && (
                  <div className="bg-zinc-900 p-3.5 rounded-xl border border-zinc-800 flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-sky-400 uppercase">Valor por Entrega (R$)</label>
                    <input 
                      type="text" 
                      value={ruleDeliveryFee} 
                      onChange={e => setRuleDeliveryFee(formatCurrencyInput(e.target.value))} 
                      placeholder="R$ 0,00" 
                      className="h-11 rounded-lg bg-zinc-950 border border-zinc-800 px-3 text-zinc-100 text-sm font-bold focus:border-sky-500 outline-none" 
                      required 
                    />
                  </div>
                )}

                {ruleType === 'fixed' && (
                  <div className="bg-zinc-900 p-3.5 rounded-xl border border-zinc-800 flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-sky-400 uppercase">Diária Fixa (R$)</label>
                    <input 
                      type="text" 
                      value={ruleFixedAmount} 
                      onChange={e => setRuleFixedAmount(formatCurrencyInput(e.target.value))} 
                      placeholder="R$ 0,00" 
                      className="h-11 rounded-lg bg-zinc-950 border border-zinc-800 px-3 text-zinc-100 text-sm font-bold focus:border-sky-500 outline-none" 
                      required 
                    />
                  </div>
                )}

                <button type="submit" className="h-12 w-full rounded-xl bg-sky-500 hover:bg-sky-400 font-bold text-zinc-950 active:scale-[0.98] shadow-md shadow-sky-500/20 mt-2 text-sm transition-all cursor-pointer">
                  Salvar Alterações
                </button>

                <div className="border-t border-zinc-800 pt-4 mt-2 flex flex-col gap-2">
                  <button type="button" onClick={toggleActive} className={`flex justify-center items-center gap-2 h-12 rounded-xl border font-bold text-xs transition-colors cursor-pointer ${selectedMotoboy.active ? 'border-amber-500/50 text-amber-500 bg-amber-500/10 hover:bg-amber-500/20' : 'border-emerald-500/50 text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20'}`}>
                    <ShieldCheck size={14} />
                    {selectedMotoboy.active ? 'Suspender / Desativar Motoboy' : 'Reativar Motoboy'}
                  </button>
                </div>

              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
