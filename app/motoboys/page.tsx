'use client';

import { useState, useMemo } from 'react';
import { 
  Users, UserPlus, Settings, FileText, Send, ChevronLeft, 
  X, Calculator, PlusCircle, Trash2, ShieldCheck, CheckCircle2 
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { toast } from 'sonner';
import type { Motoboy, MotoboyPaymentRule, PaymentRuleType } from '@/types';

type TabType = 'acerto' | 'config';

interface ValeItem {
  id: string;
  description: string;
  amount: number;
}

export default function MotoboysPage() {
  const motoboys = useAppStore(state => state.motoboys);
  const routes = useAppStore(state => state.routes);
  const deliveries = useAppStore(state => state.deliveries);
  const addMotoboy = useAppStore(state => state.addMotoboy);
  const updateMotoboy = useAppStore(state => state.updateMotoboy);

  // Estados Gerais
  const [isAdding, setIsAdding] = useState(false);
  const [newMotoboyName, setNewMotoboyName] = useState('');
  const [selectedMotoboy, setSelectedMotoboy] = useState<Motoboy | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('acerto');

  // Estados do Modal de Acerto
  const [acertoDate, setAcertoDate] = useState(new Date().toISOString().split('T')[0]);
  const [vales, setVales] = useState<ValeItem[]>([]);
  const [valeDesc, setValeDesc] = useState('');
  const [valeAmount, setValeAmount] = useState('');

  // Estados de Configuração (Regras)
  const [ruleType, setRuleType] = useState<PaymentRuleType>('fixed_plus_variable');
  const [ruleFixedAmount, setRuleFixedAmount] = useState('');
  const [ruleDeliveryFee, setRuleDeliveryFee] = useState('');
  const [ruleThreshold, setRuleThreshold] = useState('');
  const [ruleExtraFee, setRuleExtraFee] = useState('');

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
    
    const newM: Motoboy = {
      id: Date.now().toString(),
      name: newMotoboyName.trim(),
      active: true,
      payment_rule: {
        type: 'fixed_plus_variable',
        fixed_amount: 100,
        threshold: 15,
        extra_fee: 7
      }
    };
    await addMotoboy(newM);
    setNewMotoboyName('');
    setIsAdding(false);
    toast.success('Motoboy cadastrado com sucesso!');
  };

  const openMotoboyPanel = (m: Motoboy) => {
    setSelectedMotoboy(m);
    setActiveTab('acerto');
    setVales([]);
    
    // Preenche as configs atuais
    const rule = m.payment_rule || { type: 'fixed_plus_variable', fixed_amount: 100, threshold: 15, extra_fee: 7 };
    setRuleType(rule.type);
    setRuleFixedAmount(rule.fixed_amount?.toString() || '');
    setRuleDeliveryFee(rule.delivery_fee?.toString() || '');
    setRuleThreshold(rule.threshold?.toString() || '');
    setRuleExtraFee(rule.extra_fee?.toString() || '');
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMotoboy) return;

    const newRule: MotoboyPaymentRule = {
      type: ruleType,
      fixed_amount: Number(ruleFixedAmount) || 0,
      delivery_fee: Number(ruleDeliveryFee) || 0,
      threshold: Number(ruleThreshold) || 0,
      extra_fee: Number(ruleExtraFee) || 0,
    };

    await updateMotoboy(selectedMotoboy.id, { payment_rule: newRule });
    toast.success('Regras de pagamento atualizadas!');
    setSelectedMotoboy({ ...selectedMotoboy, payment_rule: newRule });
  };

  const toggleActive = async () => {
    if (!selectedMotoboy) return;
    const newStatus = !selectedMotoboy.active;
    await updateMotoboy(selectedMotoboy.id, { active: newStatus });
    setSelectedMotoboy({ ...selectedMotoboy, active: newStatus });
    toast.success(newStatus ? 'Motoboy ativado!' : 'Motoboy desativado!');
  };

  // ------------------------------------------------------------------
  // MÁQUINA DE CALCULAR ACERTO (INTELIGÊNCIA EXTREMA)
  // ------------------------------------------------------------------
  const calculateAcerto = () => {
    if (!selectedMotoboy) return null;

    // 1. Achar as rotas desse motoboy na data selecionada
    const targetDateStr = new Date(acertoDate + 'T12:00:00Z').toDateString(); // Evita fuso bugado
    
    const todaysRoutes = routes.filter(r => {
      const isSameMotoboy = r.motoboy_name.toLowerCase() === selectedMotoboy.name.toLowerCase();
      const rDateStr = new Date(r.started_at || r.departure_time).toDateString();
      return isSameMotoboy && rDateStr === targetDateStr;
    });

    // 2. Achar as entregas dessas rotas
    const todaysDeliveries = deliveries.filter(d => todaysRoutes.some(r => r.id === d.route_id));
    
    const totalDeliveries = todaysDeliveries.length;
    const deliveriesRevenue = todaysDeliveries.reduce((acc, curr) => acc + (curr.value || 0), 0);

    // 3. Aplicar a Regra de Pagamento do Perfil
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

    // 4. Subtrair os Vales
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
  };

  const acertoData = calculateAcerto();

  // ------------------------------------------------------------------
  // GERAÇÃO DO WHATSAPP (PDF MODERNO)
  // ------------------------------------------------------------------
  const handleCopyWhatsApp = async () => {
    if (!selectedMotoboy || !acertoData) return;

    const formattedDate = new Date(acertoDate + 'T12:00:00Z').toLocaleDateString('pt-BR');
    
    let text = `🏍️ *ACERTO DO DIA | DFL ENTREGAS* 🏍️\n`;
    text += `👤 *Motoboy:* ${selectedMotoboy.name}\n`;
    text += `📅 *Data:* ${formattedDate}\n\n`;
    
    text += `📦 *Entregas Realizadas:* ${acertoData.totalDeliveries}\n`;
    text += `💰 *Valor Bruto Levado:* R$ ${acertoData.deliveriesRevenue.toFixed(2).replace('.', ',')}\n\n`;

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
    toast.success('Recibo copiado!', { description: 'Pronto para colar no WhatsApp do motoboy.' });
  };

  const handleAddVale = () => {
    if (!valeDesc.trim() || !valeAmount) return toast.error('Preencha os dados do vale');
    const amountNum = parseFloat(valeAmount.replace(',', '.'));
    setVales([...vales, { id: Date.now().toString(), description: valeDesc, amount: amountNum }]);
    setValeDesc('');
    setValeAmount('');
  };

  // ============================================================================
  // RENDERS
  // ============================================================================
  return (
    <div className="flex flex-col gap-5 relative pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-bold text-zinc-50 flex items-center gap-2">
          <Users className="text-sky-400" /> Equipe de Motoboys
        </h1>
        <p className="text-sm text-zinc-500">Gerencie a frota, crie regras de pagamento e feche acertos diários.</p>
      </div>

      {!isAdding ? (
        <button onClick={() => setIsAdding(true)} className="flex items-center justify-center gap-2 bg-zinc-900 border border-dashed border-zinc-700 text-zinc-300 rounded-2xl p-4 font-bold hover:bg-zinc-800 transition-colors">
          <UserPlus size={18} /> Adicionar Novo Motoboy
        </button>
      ) : (
        <div className="flex gap-2 animate-in fade-in slide-in-from-top-4">
          <input 
            type="text" 
            placeholder="Nome do motoboy..." 
            value={newMotoboyName} 
            onChange={(e) => setNewMotoboyName(e.target.value)} 
            className="flex-1 h-14 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 text-zinc-100 focus:border-sky-500 focus:outline-none" 
            autoFocus
          />
          <button onClick={handleAddMotoboy} className="h-14 px-6 rounded-2xl bg-sky-500 text-zinc-950 font-bold hover:bg-sky-400">
            Salvar
          </button>
          <button onClick={() => setIsAdding(false)} className="h-14 w-14 flex items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-400">
            <X size={20} />
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {sortedMotoboys.map(m => (
          <button 
            key={m.id} 
            onClick={() => openMotoboyPanel(m)}
            className={`flex items-center justify-between p-5 rounded-[24px] border border-zinc-800/80 transition-all ${m.active ? 'bg-zinc-900/40 hover:bg-zinc-800/60' : 'bg-zinc-950/50 opacity-60 grayscale'}`}
          >
            <div className="flex items-center gap-4">
              <div className={`h-12 w-12 rounded-full flex items-center justify-center font-bold text-lg ${m.active ? 'bg-sky-500/10 text-sky-500' : 'bg-zinc-800 text-zinc-500'}`}>
                {m.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col items-start">
                <span className="font-bold text-zinc-100 text-lg">{m.name}</span>
                <span className="text-xs text-zinc-500 flex items-center gap-1">
                  {m.active ? <><ShieldCheck size={12} className="text-emerald-500"/> Ativo</> : 'Inativo'}
                </span>
              </div>
            </div>
            <ChevronLeft className="text-zinc-600 rotate-180" size={20} />
          </button>
        ))}
      </div>

      {/* MODAL GIGANTE DO MOTOBOY */}
      {selectedMotoboy && (
        <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950/95 backdrop-blur-md animate-in fade-in duration-200">
          <div className="flex items-center justify-between p-5 border-b border-zinc-900 bg-zinc-950">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-sky-500/10 flex items-center justify-center text-sky-400 font-bold">
                {selectedMotoboy.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-xl font-black text-zinc-50">{selectedMotoboy.name}</h2>
              </div>
            </div>
            <button onClick={() => setSelectedMotoboy(null)} className="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white">
              <X size={20} />
            </button>
          </div>

          <div className="flex bg-zinc-900 p-1.5 border-b border-zinc-800">
            <button onClick={() => setActiveTab('acerto')} className={`flex-1 flex justify-center gap-2 py-3 rounded-lg font-bold text-xs transition-all ${activeTab === 'acerto' ? 'bg-zinc-800 text-emerald-400 shadow-md' : 'text-zinc-500'}`}>
              <Calculator size={16} /> Acerto Diário
            </button>
            <button onClick={() => setActiveTab('config')} className={`flex-1 flex justify-center gap-2 py-3 rounded-lg font-bold text-xs transition-all ${activeTab === 'config' ? 'bg-zinc-800 text-sky-400 shadow-md' : 'text-zinc-500'}`}>
              <Settings size={16} /> Config. de Pagamento
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
            
            {/* --- ABA 1: ACERTO DIÁRIO (MÁQUINA DE RECIBO) --- */}
            {activeTab === 'acerto' && acertoData && (
              <div className="flex flex-col gap-5 animate-in slide-in-from-right-8">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-zinc-400">Qual dia você quer fechar?</label>
                  <input type="date" value={acertoDate} onChange={(e) => setAcertoDate(e.target.value)} className="h-14 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 text-zinc-100 focus:border-emerald-500 font-bold" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-[20px] flex flex-col gap-1">
                    <span className="text-xs font-semibold text-zinc-500 uppercase">Entregas</span>
                    <span className="text-2xl font-black text-zinc-100">{acertoData.totalDeliveries}</span>
                  </div>
                  <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-[20px] flex flex-col gap-1">
                    <span className="text-xs font-semibold text-zinc-500 uppercase">Valor Bruto</span>
                    <span className="text-2xl font-black text-amber-500">R$ {acertoData.deliveriesRevenue.toFixed(2).replace('.', ',')}</span>
                  </div>
                </div>

                <div className="bg-sky-500/5 border border-sky-500/20 p-4 rounded-[20px] flex flex-col gap-2">
                  <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">Lógica Aplicada</span>
                  <p className="text-sm font-medium text-zinc-300">{acertoData.calculationDesc}</p>
                  <span className="text-xl font-black text-sky-400 mt-1">R$ {acertoData.calculatedAmount.toFixed(2).replace('.', ',')}</span>
                </div>

                <div className="border-t border-zinc-800 pt-5 flex flex-col gap-4">
                  <h3 className="font-bold text-zinc-200">Vales / Retenções</h3>
                  <div className="flex gap-2">
                    <input type="text" placeholder="Ex: Lanche" value={valeDesc} onChange={(e)=>setValeDesc(e.target.value)} className="flex-[2] h-12 rounded-xl bg-zinc-900 border border-zinc-800 px-3 text-sm text-zinc-100" />
                    <input type="number" placeholder="R$ 0,00" value={valeAmount} onChange={(e)=>setValeAmount(e.target.value)} className="flex-1 h-12 rounded-xl bg-zinc-900 border border-zinc-800 px-3 text-sm text-zinc-100" />
                    <button onClick={handleAddVale} className="h-12 w-12 flex items-center justify-center bg-zinc-800 rounded-xl text-zinc-300 hover:bg-zinc-700"><PlusCircle size={20}/></button>
                  </div>

                  {vales.length > 0 && (
                    <div className="flex flex-col gap-2">
                      {vales.map(v => (
                        <div key={v.id} className="flex justify-between items-center bg-red-500/10 border border-red-500/20 p-3 rounded-xl">
                          <span className="text-sm text-red-400 font-semibold">{v.description}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-red-400 font-bold">- R$ {v.amount.toFixed(2).replace('.', ',')}</span>
                            <button onClick={()=>setVales(vales.filter(x => x.id !== v.id))} className="text-red-500/50 hover:text-red-500"><Trash2 size={16}/></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-[24px] flex items-center justify-between mt-2">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-emerald-500 uppercase tracking-widest">Total a Receber</span>
                    <span className="text-3xl font-black text-emerald-400 mt-1">R$ {acertoData.finalAmountToPay.toFixed(2).replace('.', ',')}</span>
                  </div>
                  <CheckCircle2 size={32} className="text-emerald-500/30" />
                </div>

                <button onClick={handleCopyWhatsApp} className="w-full flex items-center justify-center gap-2 h-14 bg-emerald-500 hover:bg-emerald-400 rounded-2xl font-black text-zinc-950 text-lg shadow-lg shadow-emerald-500/20 mt-2 active:scale-95 transition-all">
                  <Send size={20} /> Copiar Recibo p/ WhatsApp
                </button>
              </div>
            )}

            {/* --- ABA 2: CONFIGURAÇÕES E REGRAS --- */}
            {activeTab === 'config' && (
              <form onSubmit={handleSaveConfig} className="flex flex-col gap-5 animate-in slide-in-from-left-8">
                
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-zinc-400">Qual é a regra desse motoboy?</label>
                  <select 
                    value={ruleType} 
                    onChange={(e) => setRuleType(e.target.value as PaymentRuleType)}
                    className="h-14 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 text-zinc-100 focus:border-sky-500 font-semibold"
                  >
                    <option value="fixed_plus_variable">Fixo Mínimo + Taxa Extra</option>
                    <option value="per_delivery">Apenas por Entrega (Fixo)</option>
                    <option value="fixed">Apenas Diária Fixa</option>
                  </select>
                </div>

                {ruleType === 'fixed_plus_variable' && (
                  <div className="grid grid-cols-2 gap-4 bg-zinc-900 p-4 rounded-2xl border border-zinc-800/80">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-zinc-500 uppercase">Valor Fixo (R$)</label>
                      <input type="number" value={ruleFixedAmount} onChange={e => setRuleFixedAmount(e.target.value)} placeholder="Ex: 100" className="h-12 rounded-xl bg-zinc-950 border border-zinc-800 px-3 text-zinc-100" required />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-zinc-500 uppercase">Até Quantas?</label>
                      <input type="number" value={ruleThreshold} onChange={e => setRuleThreshold(e.target.value)} placeholder="Ex: 15" className="h-12 rounded-xl bg-zinc-950 border border-zinc-800 px-3 text-zinc-100" required />
                    </div>
                    <div className="flex flex-col gap-1.5 col-span-2 border-t border-zinc-800 pt-3">
                      <label className="text-xs font-bold text-zinc-500 uppercase text-sky-400">Taxa após limite (R$/Entrega)</label>
                      <input type="number" value={ruleExtraFee} onChange={e => setRuleExtraFee(e.target.value)} placeholder="Ex: 7" className="h-12 rounded-xl bg-zinc-950 border border-zinc-800 px-3 text-zinc-100" required />
                    </div>
                  </div>
                )}

                {ruleType === 'per_delivery' && (
                  <div className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800/80 flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-zinc-500 uppercase text-sky-400">Valor Fixo por Entrega (R$)</label>
                    <input type="number" value={ruleDeliveryFee} onChange={e => setRuleDeliveryFee(e.target.value)} placeholder="Ex: 6.50" className="h-12 rounded-xl bg-zinc-950 border border-zinc-800 px-3 text-zinc-100" required />
                  </div>
                )}

                {ruleType === 'fixed' && (
                  <div className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800/80 flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-zinc-500 uppercase text-sky-400">Diária Fixa Completa (R$)</label>
                    <input type="number" value={ruleFixedAmount} onChange={e => setRuleFixedAmount(e.target.value)} placeholder="Ex: 120" className="h-12 rounded-xl bg-zinc-950 border border-zinc-800 px-3 text-zinc-100" required />
                  </div>
                )}

                <button type="submit" className="h-14 w-full rounded-2xl bg-sky-500 font-bold text-zinc-950 active:scale-[0.98] shadow-lg shadow-sky-500/20 mt-4">
                  Salvar Regras de Pagamento
                </button>

                <div className="border-t border-zinc-800 pt-6 mt-4 flex flex-col gap-3">
                  <h4 className="font-bold text-zinc-300">Zona de Perigo</h4>
                  <button type="button" onClick={toggleActive} className={`h-14 rounded-2xl border font-bold ${selectedMotoboy.active ? 'border-amber-500/50 text-amber-500 bg-amber-500/10' : 'border-emerald-500/50 text-emerald-500 bg-emerald-500/10'}`}>
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
