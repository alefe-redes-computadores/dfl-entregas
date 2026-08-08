'use client';

import { useState, useMemo } from 'react';
import { 
  Users, UserPlus, Calculator, PlusCircle, Trash2, ShieldCheck, 
  CheckCircle2, Package, Wallet, TrendingUp, CalendarDays, Receipt, X, Send, Settings, Check, ChevronLeft, ChevronRight,
  User, UserRound, Bike, Star, Crown, Store, Camera
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

// ============================================================================
// CONFIGURAÇÃO DOS AVATARES (LUCIDE ICONS + TAILWIND COLORS)
// ============================================================================
const AVATAR_OPTIONS = [
  { id: 'man-blue', type: 'user', color: 'text-blue-500', bg: 'bg-blue-500/10', label: 'Rapaz (Azul)' },
  { id: 'man-emerald', type: 'user', color: 'text-emerald-500', bg: 'bg-emerald-500/10', label: 'Rapaz (Verde)' },
  { id: 'man-amber', type: 'user', color: 'text-amber-500', bg: 'bg-amber-500/10', label: 'Rapaz (Laranja)' },
  { id: 'woman-pink', type: 'user-round', color: 'text-pink-500', bg: 'bg-pink-500/10', label: 'Moça (Rosa)' },
  { id: 'woman-purple', type: 'user-round', color: 'text-purple-500', bg: 'bg-purple-500/10', label: 'Moça (Roxa)' },
  { id: 'woman-sky', type: 'user-round', color: 'text-sky-500', bg: 'bg-sky-500/10', label: 'Moça (Azul Claro)' },
  { id: 'bike-amber', type: 'bike', color: 'text-amber-500', bg: 'bg-amber-500/10', label: 'Moto (Laranja)' },
  { id: 'bike-sky', type: 'bike', color: 'text-sky-500', bg: 'bg-sky-500/10', label: 'Moto (Azul)' },
];

const RenderAvatarIcon = ({ id, size = 20, className = '' }: { id?: string, size?: number, className?: string }) => {
  const config = AVATAR_OPTIONS.find(a => a.id === id) || AVATAR_OPTIONS[0];
  let Icon = User;
  if (config.type === 'user-round') Icon = UserRound;
  if (config.type === 'bike') Icon = Bike;
  if (config.type === 'star') Icon = Star;
  if (config.type === 'crown') Icon = Crown;
  if (config.type === 'store') Icon = Store;

  return <Icon size={size} className={`${config.color} ${className}`} />;
};

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
  const [newMotoboyAvatar, setNewMotoboyAvatar] = useState('bike-amber');
  
  const [selectedMotoboy, setSelectedMotoboy] = useState<Motoboy & { type?: 'fixo' | 'avulso' } | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('acerto');

  // Estado do Modal de Avatares
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [avatarTarget, setAvatarTarget] = useState<'new' | 'edit'>('new');

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

  const [ruleType, setRuleType] = useState<PaymentRuleType>('fixed_plus_variable');
  const [ruleFixedAmount, setRuleFixedAmount] = useState('');
  const [ruleDeliveryFee, setRuleDeliveryFee] = useState('');
  const [ruleThreshold, setRuleThreshold] = useState('');
  const [ruleExtraFee, setRuleExtraFee] = useState('');
  const [editType, setEditType] = useState<'fixo' | 'avulso'>('fixo');
  const [editAvatar, setEditAvatar] = useState('');

  const handleShiftDate = (days: number) => {
    const [year, month, day] = acertoDate.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    d.setDate(d.getDate() + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dt = String(d.getDate()).padStart(2, '0');
    setAcertoDate(`${y}-${m}-${dt}`);
  };

  const handleSetToday = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const dt = String(now.getDate()).padStart(2, '0');
    setAcertoDate(`${y}-${m}-${dt}`);
  };

  const sortedMotoboys = useMemo(() => {
    return [...motoboys].sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [motoboys]);

  const handleAddMotoboy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMotoboyName.trim()) return;
    
    const newM: Motoboy & { type?: 'fixo' | 'avulso' } = {
      id: Date.now().toString(),
      name: newMotoboyName.trim(),
      active: true,
      type: newMotoboyType,
      avatar: newMotoboyAvatar,
      payment_rule: {
        type: 'fixed_plus_variable',
        fixed_amount: 100,
        threshold: 15,
        extra_fee: 7
      }
    };
    await addMotoboy(newM as Motoboy);
    setNewMotoboyName('');
    setNewMotoboyAvatar('bike-amber');
    setIsAdding(false);
    toast.success('Motoboy cadastrado com sucesso!');
  };

  const openMotoboyPanel = (m: Motoboy & { type?: 'fixo' | 'avulso' }) => {
    setSelectedMotoboy(m);
    setActiveTab('acerto');
    setVales([]);
    setEditType(m.type || 'fixo');
    setEditAvatar(m.avatar || 'man-blue');
    
    const rule = m.payment_rule || { type: 'fixed_plus_variable', fixed_amount: 100, threshold: 15, extra_fee: 7 };
    setRuleType(rule.type);
    
    setRuleFixedAmount((rule.fixed_amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    setRuleDeliveryFee((rule.delivery_fee || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    setRuleThreshold(rule.threshold?.toString() || '0');
    setRuleExtraFee((rule.extra_fee || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
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
      type: editType,
      avatar: editAvatar 
    } as any);

    toast.success('Configurações salvas!');
    setSelectedMotoboy(null);
  };

  const toggleActive = async () => {
    if (!selectedMotoboy) return;
    const newStatus = !selectedMotoboy.active;
    await updateMotoboy(selectedMotoboy.id, { active: newStatus });
    setSelectedMotoboy({ ...selectedMotoboy, active: newStatus });
    toast.success(newStatus ? 'Motoboy ativado!' : 'Motoboy desativado!');
  };

  const acertoData = useMemo(() => {
    if (!selectedMotoboy) return null;
    const motoboyNameLower = selectedMotoboy.name.toLowerCase().trim();
    const getSafeDate = (rawDate: any) => {
      if (!rawDate) return '';
      const d = new Date(rawDate);
      if (isNaN(d.getTime())) return '';
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const todaysRoutes = routes.filter(r => {
      const isSameMotoboy = ((r as any).motoboy_name || '').toLowerCase().trim() === motoboyNameLower;
      if (!isSameMotoboy) return false;
      const rDateStr = getSafeDate(r.started_at || (r as any).departure_time || r.updated_at);
      return rDateStr === acertoDate;
    });

    const routeIds = new Set(todaysRoutes.map(r => r.id));
    const todaysDeliveries = deliveries.filter(d => {
      const belongsToRoute = d.route_id && routeIds.has(d.route_id);
      if (belongsToRoute) return true;
      const dMotoboy = ((d as any).motoboy_name || '').toLowerCase().trim();
      const isSameMotoboy = dMotoboy === motoboyNameLower;
      if (!isSameMotoboy) return false;
      const dDateStr = getSafeDate(d.updated_at || (d as any).createdAt);
      return dDateStr === acertoDate;
    });
    
    const totalDeliveries = todaysDeliveries.length;
    const deliveriesRevenue = todaysDeliveries.reduce((acc, curr) => acc + (curr.value || 0), 0);
    const rule = selectedMotoboy.payment_rule || { type: 'fixed_plus_variable', fixed_amount: 100, threshold: 15, extra_fee: 7 };
    let calculatedAmount = 0;
    let calculationDesc = '';

    if (rule.type === 'fixed') {
      calculatedAmount = rule.fixed_amount || 0;
      calculationDesc = `Taxa Fixa Diária: R$ ${(rule.fixed_amount || 0).toFixed(2)}`;
    } else if (rule.type === 'per_delivery') {
      calculatedAmount = totalDeliveries * (rule.delivery_fee || 0);
      calculationDesc = `${totalDeliveries} entregas x R$ ${(rule.delivery_fee || 0).toFixed(2)}`;
    } else if (rule.type === 'fixed_plus_variable') {
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

    return { totalDeliveries, deliveriesRevenue, calculatedAmount, calculationDesc, totalVales, finalAmountToPay };
  }, [selectedMotoboy, acertoDate, routes, deliveries, vales]);

  const handleCopyWhatsApp = async () => {
    if (!selectedMotoboy || !acertoData) return;
    const [year, month, day] = acertoDate.split('-');
    const formattedDate = `${day}/${month}/${year}`;
    let text = `🏍️ *ACERTO DIÁRIO | DFL ENTREGAS* 🏍️\n`;
    text += `👤 *Motoboy:* ${selectedMotoboy.name}\n`;
    text += `📅 *Data:* ${formattedDate}\n\n`;
    text += `📦 *Entregas Realizadas:* ${acertoData.totalDeliveries}\n\n`;
    text += `📈 *Cálculo do Repasse:*\n`;
    text += `   ↳ ${acertoData.calculationDesc} = *R$ ${acertoData.calculatedAmount.toFixed(2).replace('.', ',')}*\n\n`;
    if (vales.length > 0) {
      text += `➖ *Vales / Retenções / Caixas:*\n`;
      vales.forEach(v => { text += `   - ${v.description}: R$ ${v.amount.toFixed(2).replace('.', ',')}\n`; });
      text += `   *Total Abatido:* R$ ${acertoData.totalVales.toFixed(2).replace('.', ',')}\n\n`;
    }
    text += `💵 *TOTAL A RECEBER:* *R$ ${acertoData.finalAmountToPay.toFixed(2).replace('.', ',')}* 💵`;
    await navigator.clipboard.writeText(text);
    toast.success('Recibo copiado para o WhatsApp!');
  };

  const handleAddVale = () => {
    if (!valeDesc.trim() || !valeAmount) return toast.error('Preencha a descrição e o valor do vale');
    const amountNum = parseCurrencyToNumber(valeAmount);
    setVales([...vales, { id: Date.now().toString(), description: valeDesc, amount: amountNum }]);
    setValeDesc('');
    setValeAmount('');
  };

  const openAvatarPicker = (target: 'new' | 'edit') => {
    setAvatarTarget(target);
    setIsAvatarModalOpen(true);
  };

  const selectAvatar = (id: string) => {
    if (avatarTarget === 'new') setNewMotoboyAvatar(id);
    else setEditAvatar(id);
    setIsAvatarModalOpen(false);
  };

  return (
    <div className="flex flex-col gap-5 relative pb-24">
      
      <PageHeader title="Equipe de Motoboys" subtitle="Gerencie frotas, regras e acertos" to="/loja" />

      {!isAdding ? (
        <button onClick={() => setIsAdding(true)} className="flex items-center justify-center gap-2 bg-zinc-900/60 border border-dashed border-zinc-700 text-zinc-300 rounded-2xl p-4 font-bold hover:bg-zinc-800 transition-colors cursor-pointer">
          <UserPlus size={18} /> Adicionar Novo Motoboy
        </button>
      ) : (
        <div className="flex flex-col gap-3 p-4 bg-zinc-900 border border-zinc-800 rounded-2xl animate-in fade-in">
          <div className="flex items-center gap-4">
            <button 
              type="button"
              onClick={() => openAvatarPicker('new')}
              className="relative h-14 w-14 rounded-full bg-zinc-950 border border-zinc-800 flex items-center justify-center hover:bg-zinc-800 transition-colors shrink-0 overflow-hidden group"
            >
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <Camera size={16} className="text-white" />
              </div>
              <RenderAvatarIcon id={newMotoboyAvatar} size={24} />
            </button>
            <div className="flex-1 flex flex-col gap-2">
              <input 
                type="text" 
                placeholder="Nome do motoboy..." 
                value={newMotoboyName} 
                onChange={(e) => setNewMotoboyName(e.target.value)} 
                className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-zinc-100 focus:border-sky-500 focus:outline-none text-sm" 
                autoFocus
              />
            </div>
          </div>
          
          <div className="flex bg-zinc-950 border border-zinc-800 rounded-xl p-1 mt-1">
            <button type="button" onClick={() => setNewMotoboyType('fixo')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${newMotoboyType === 'fixo' ? 'bg-sky-500 text-zinc-950' : 'text-zinc-400'}`}>Fixo</button>
            <button type="button" onClick={() => setNewMotoboyType('avulso')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${newMotoboyType === 'avulso' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400'}`}>Avulso</button>
          </div>

          <div className="flex gap-2 mt-2">
            <button onClick={handleAddMotoboy} className="flex-1 h-11 rounded-xl bg-sky-500 text-zinc-950 font-bold text-sm hover:bg-sky-400">Salvar Motoboy</button>
            <button onClick={() => setIsAdding(false)} className="h-11 px-4 rounded-xl bg-zinc-800 text-zinc-400 text-sm hover:bg-zinc-700">Cancelar</button>
          </div>
        </div>
      )}

      {/* LISTA DE MOTOBOYS */}
      <div className="flex flex-col gap-3">
        {sortedMotoboys.map(m => {
          const type = (m as any).type || 'fixo';
          const avatarConfig = AVATAR_OPTIONS.find(a => a.id === m.avatar) || AVATAR_OPTIONS[0];
          
          return (
            <button 
              key={m.id} 
              onClick={() => openMotoboyPanel(m)}
              className={`flex items-center justify-between p-4 rounded-[24px] border border-zinc-800/80 transition-all cursor-pointer ${m.active ? 'bg-zinc-900/40 hover:bg-zinc-800/60' : 'bg-zinc-950/50 opacity-60 grayscale'}`}
            >
              <div className="flex items-center gap-3">
                <div className={`h-11 w-11 rounded-full flex items-center justify-center border ${m.active ? `${avatarConfig.bg} border-${avatarConfig.color.split('-')[1]}-500/20` : 'bg-zinc-800 border-zinc-700'}`}>
                  <RenderAvatarIcon id={m.avatar} size={20} className={!m.active ? 'text-zinc-500' : ''} />
                </div>
                
                <div className="flex flex-col items-start gap-1">
                  <span className="font-bold text-zinc-100 text-base">{m.name}</span>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${type === 'fixo' ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30' : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'}`}>
                      {type}
                    </span>
                    {!m.active && (
                      <span className="flex items-center gap-1 text-[10px] text-zinc-500 font-semibold"><Users size={10} /> Inativo</span>
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

      {/* MODAL DO MOTOBOY */}
      {selectedMotoboy && (
        <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950/95 backdrop-blur-md animate-in fade-in duration-200">
          
          <div className="flex items-center justify-between px-4 pb-4 pt-12 border-b border-zinc-900 bg-zinc-950 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-sky-500/10 flex items-center justify-center">
                <RenderAvatarIcon id={selectedMotoboy.avatar} size={20} />
              </div>
              <div>
                <h2 className="text-lg font-black text-zinc-50">{selectedMotoboy.name}</h2>
                <p className="text-xs text-zinc-500">Central de Fechamento e Regras</p>
              </div>
            </div>
            <button onClick={() => setSelectedMotoboy(null)} className="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white">
              <X size={20} />
            </button>
          </div>

          <div className="flex bg-zinc-900 p-1.5 border-b border-zinc-800">
            <button onClick={() => setActiveTab('acerto')} className={`flex-1 flex justify-center items-center gap-2 py-2.5 rounded-lg font-bold text-xs transition-all ${activeTab === 'acerto' ? 'bg-zinc-800 text-emerald-400 shadow-md' : 'text-zinc-500'}`}><Receipt size={14} /> Acerto Diário</button>
            <button onClick={() => setActiveTab('config')} className={`flex-1 flex justify-center items-center gap-2 py-2.5 rounded-lg font-bold text-xs transition-all ${activeTab === 'config' ? 'bg-zinc-800 text-sky-400 shadow-md' : 'text-zinc-500'}`}><Settings size={14} /> Regras & Tipo</button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pt-4 pb-12 flex flex-col gap-5">
            {activeTab === 'acerto' && acertoData && (
              <div className="flex flex-col gap-4 animate-in slide-in-from-right-4">
                <div className="flex flex-col gap-2 bg-zinc-900/60 border border-zinc-800 p-3.5 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-400 flex items-center gap-1.5"><CalendarDays size={14} className="text-emerald-400" /> Data do Acerto</span>
                    <button type="button" onClick={handleSetToday} className="text-[10px] font-extrabold px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">Hoje</button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => handleShiftDate(-1)} className="h-12 w-12 flex items-center justify-center bg-zinc-800 text-zinc-200 rounded-xl"><ChevronLeft size={22} /></button>
                    <div className="flex-1 h-12 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-center px-4 font-black text-zinc-100 text-sm tracking-widest">{(() => { const [y, m, d] = acertoDate.split('-'); return `${d}/${m}/${y}`; })()}</div>
                    <button type="button" onClick={() => handleShiftDate(1)} className="h-12 w-12 flex items-center justify-center bg-zinc-800 text-zinc-200 rounded-xl"><ChevronRight size={22} /></button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-zinc-900/80 border border-zinc-800 p-3.5 rounded-2xl flex flex-col gap-1"><span className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 uppercase"><Package size={12} className="text-emerald-500" /> Entregas</span><span className="text-2xl font-black text-emerald-400">{acertoData.totalDeliveries}</span></div>
                  <div className="bg-zinc-900/80 border border-zinc-800 p-3.5 rounded-2xl flex flex-col gap-1"><span className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 uppercase"><Wallet size={12} className="text-amber-500" /> Valor Bruto</span><span className="text-2xl font-black text-amber-500">R$ {acertoData.deliveriesRevenue.toFixed(2).replace('.', ',')}</span></div>
                </div>

                <div className="bg-sky-500/5 border border-sky-500/20 p-4 rounded-2xl flex flex-col gap-1.5"><span className="flex items-center gap-1.5 text-[10px] font-bold text-sky-400 uppercase tracking-wider"><TrendingUp size={12} /> Cálculo Automático</span><p className="text-xs font-medium text-zinc-300">{acertoData.calculationDesc}</p><span className="text-xl font-black text-sky-400 mt-1">R$ {acertoData.calculatedAmount.toFixed(2).replace('.', ',')}</span></div>

                <div className="border-t border-zinc-800 pt-4 flex flex-col gap-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Abatimentos / Vales (Opcional)</h3>
                  <div className="flex items-center gap-2 w-full">
                    <input type="text" placeholder="Ex: Lanche" value={valeDesc} onChange={(e)=>setValeDesc(e.target.value)} className="flex-[2] min-w-0 h-11 rounded-xl bg-zinc-900 border border-zinc-800 px-3 text-xs text-zinc-100" />
                    <input type="text" placeholder="R$ 0,00" value={valeAmount} onChange={(e)=>setValeAmount(formatCurrencyInput(e.target.value))} className="flex-1 min-w-0 h-11 rounded-xl bg-zinc-900 border border-zinc-800 px-3 text-xs text-zinc-100 font-bold" />
                    <button onClick={handleAddVale} className="h-11 w-11 shrink-0 flex items-center justify-center bg-zinc-800 rounded-xl text-zinc-300"><PlusCircle size={18}/></button>
                  </div>
                  {vales.length > 0 && (<div className="flex flex-col gap-2">{vales.map(v => (<div key={v.id} className="flex justify-between items-center bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl"><span className="text-xs text-red-400 font-semibold">{v.description}</span><div className="flex items-center gap-3"><span className="text-xs text-red-400 font-bold">- R$ {v.amount.toFixed(2).replace('.', ',')}</span><button onClick={()=>setVales(vales.filter(x => x.id !== v.id))} className="text-red-500/50 hover:text-red-500"><Trash2 size={14}/></button></div></div>))}</div>)}
                </div>

                <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl flex items-center justify-between"><div className="flex flex-col"><span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Total Líquido a Pagar</span><span className="text-2xl font-black text-emerald-400 mt-0.5">R$ {acertoData.finalAmountToPay.toFixed(2).replace('.', ',')}</span></div><CheckCircle2 size={28} className="text-emerald-500/30" /></div>
                <button onClick={handleCopyWhatsApp} className="w-full flex items-center justify-center gap-2 h-14 bg-emerald-500 hover:bg-emerald-400 rounded-xl font-bold text-zinc-950 text-base shadow-lg shadow-emerald-500/20 active:scale-95"><Send size={18} /> Enviar Recibo WhatsApp</button>
              </div>
            )}

            {activeTab === 'config' && (
              <form onSubmit={handleSaveConfig} className="flex flex-col gap-4 animate-in slide-in-from-left-4">
                
                <div className="flex items-center gap-4 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
                  <button type="button" onClick={() => openAvatarPicker('edit')} className="relative h-14 w-14 rounded-full bg-zinc-950 border border-zinc-800 flex items-center justify-center hover:bg-zinc-800 group overflow-hidden shrink-0">
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 z-10"><Camera size={16} className="text-white" /></div>
                    <RenderAvatarIcon id={editAvatar} size={24} />
                  </button>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-zinc-100">Foto do Perfil</span>
                    <span className="text-xs text-zinc-500">Clique para alterar o avatar.</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-400">Tipo de Contratação</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setEditType('fixo')} className={`h-12 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 ${editType === 'fixo' ? 'bg-sky-500/15 border-sky-500 text-sky-400 shadow-md' : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>{editType === 'fixo' && <Check size={14} />} Fixo</button>
                    <button type="button" onClick={() => setEditType('avulso')} className={`h-12 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 ${editType === 'avulso' ? 'bg-amber-500/15 border-amber-500 text-amber-400 shadow-md' : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>{editType === 'avulso' && <Check size={14} />} Avulso</button>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5"><label className="text-xs font-semibold text-zinc-400">Regra de Pagamento</label><div className="flex flex-col gap-2">{[{ id: 'fixed_plus_variable', label: 'Fixo Mínimo + Taxa Extra' },{ id: 'per_delivery', label: 'Apenas por Entrega (Fixo)' },{ id: 'fixed', label: 'Apenas Diária Fixa' },].map((item) => (<button key={item.id} type="button" onClick={() => setRuleType(item.id as PaymentRuleType)} className={`flex items-center justify-between p-3.5 rounded-xl border text-left font-semibold text-xs ${ruleType === item.id ? 'bg-sky-500/10 border-sky-500 text-sky-400' : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>{item.label}{ruleType === item.id && <Check size={16} className="text-sky-400" />}</button>))}</div></div>

                {ruleType === 'fixed_plus_variable' && (<div className="grid grid-cols-2 gap-3 bg-zinc-900 p-3.5 rounded-xl border border-zinc-800"><div className="flex flex-col gap-1"><label className="text-[10px] font-bold text-zinc-500 uppercase">Valor Fixo (R$)</label><input type="text" value={ruleFixedAmount} onChange={e => setRuleFixedAmount(formatCurrencyInput(e.target.value))} placeholder="0,00" className="h-11 rounded-lg bg-zinc-950 border border-zinc-800 px-3 text-zinc-100 text-sm font-bold" required /></div><div className="flex flex-col gap-1"><label className="text-[10px] font-bold text-zinc-500 uppercase">Até Quantas?</label><input type="number" value={ruleThreshold} onChange={e => setRuleThreshold(e.target.value)} placeholder="Ex: 15" className="h-11 rounded-lg bg-zinc-950 border border-zinc-800 px-3 text-zinc-100 text-sm font-bold" required /></div><div className="flex flex-col gap-1 col-span-2 border-t border-zinc-800 pt-2.5"><label className="text-[10px] font-bold text-sky-400 uppercase">Taxa por entrega extra (R$)</label><input type="text" value={ruleExtraFee} onChange={e => setRuleExtraFee(formatCurrencyInput(e.target.value))} placeholder="0,00" className="h-11 rounded-lg bg-zinc-950 border border-zinc-800 px-3 text-zinc-100 text-sm font-bold" required /></div></div>)}
                {ruleType === 'per_delivery' && (<div className="bg-zinc-900 p-3.5 rounded-xl border border-zinc-800 flex flex-col gap-1"><label className="text-[10px] font-bold text-sky-400 uppercase">Valor por Entrega (R$)</label><input type="text" value={ruleDeliveryFee} onChange={e => setRuleDeliveryFee(formatCurrencyInput(e.target.value))} placeholder="0,00" className="h-11 rounded-lg bg-zinc-950 border border-zinc-800 px-3 text-zinc-100 text-sm font-bold" required /></div>)}
                {ruleType === 'fixed' && (<div className="bg-zinc-900 p-3.5 rounded-xl border border-zinc-800 flex flex-col gap-1"><label className="text-[10px] font-bold text-sky-400 uppercase">Diária Fixa (R$)</label><input type="text" value={ruleFixedAmount} onChange={e => setRuleFixedAmount(formatCurrencyInput(e.target.value))} placeholder="0,00" className="h-11 rounded-lg bg-zinc-950 border border-zinc-800 px-3 text-zinc-100 text-sm font-bold" required /></div>)}

                <button type="submit" className="h-12 w-full rounded-xl bg-sky-500 font-bold text-zinc-950 active:scale-[0.98] mt-2 text-sm">Salvar Alterações</button>

                <div className="border-t border-zinc-800 pt-4 mt-2 flex flex-col gap-2">
                  <button type="button" onClick={toggleActive} className={`flex justify-center items-center gap-2 h-12 rounded-xl border font-bold text-xs ${selectedMotoboy.active ? 'border-amber-500/50 text-amber-500 bg-amber-500/10' : 'border-emerald-500/50 text-emerald-500 bg-emerald-500/10'}`}>
                    <ShieldCheck size={14} />{selectedMotoboy.active ? 'Suspender Motoboy' : 'Reativar Motoboy'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL DE ESCOLHA DE AVATAR */}
      {isAvatarModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-zinc-50">Escolha o Avatar</h3>
              <button onClick={() => setIsAvatarModalOpen(false)} className="text-zinc-500 hover:text-zinc-300"><X size={20}/></button>
            </div>
            
            <div className="grid grid-cols-4 gap-3">
              {AVATAR_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => selectAvatar(opt.id)}
                  className={`flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border transition-all ${
                    (avatarTarget === 'new' ? newMotoboyAvatar : editAvatar) === opt.id
                      ? `bg-zinc-800 border-zinc-600 shadow-md`
                      : `bg-zinc-950 border-zinc-800/80 hover:bg-zinc-800`
                  }`}
                >
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center ${opt.bg}`}>
                    <RenderAvatarIcon id={opt.id} size={20} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
