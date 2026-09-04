'use client';

import { useState, useMemo } from 'react';
import { 
  Users, UserPlus, Calculator, PlusCircle, Trash2, ShieldCheck, 
  CheckCircle2, Package, Banknote, CalendarDays, Receipt, X, Send, Settings, Check, ChevronLeft, ChevronRight,
  User, UserRound, Bike, Star, Crown, Store, Camera, ArrowDownLeft, ArrowUpRight, TrendingUp, AlertTriangle
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import type { Motoboy, MotoboyPaymentRule, PaymentRuleType, Delivery } from '@/types';

type TabType = 'acerto' | 'config';

interface ValeItem {
  id: string;
  description: string;
  amount: number;
}

const AVATAR_OPTIONS = [
  { id: 'man-blue', type: 'user', color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { id: 'man-emerald', type: 'user', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { id: 'man-amber', type: 'user', color: 'text-amber-500', bg: 'bg-amber-500/10' },
  { id: 'woman-pink', type: 'user-round', color: 'text-pink-500', bg: 'bg-pink-500/10' },
  { id: 'woman-purple', type: 'user-round', color: 'text-purple-500', bg: 'bg-purple-500/10' },
  { id: 'woman-sky', type: 'user-round', color: 'text-sky-500', bg: 'bg-sky-500/10' },
  { id: 'bike-amber', type: 'bike', color: 'text-amber-500', bg: 'bg-amber-500/10' },
  { id: 'bike-sky', type: 'bike', color: 'text-sky-500', bg: 'bg-sky-500/10' },
];

const RenderAvatarIcon = ({ id, size = 20, className = '' }: { id?: string; size?: number; className?: string }) => {
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

  const [listFilter, setListFilter] = useState<'ativos' | 'inativos'>('ativos');

  const [isAdding, setIsAdding] = useState(false);
  const [newMotoboyName, setNewMotoboyName] = useState('');
  const [newMotoboyType, setNewMotoboyType] = useState<'fixo' | 'avulso'>('fixo');
  const [newMotoboyAvatar, setNewMotoboyAvatar] = useState('bike-amber');
  
  const [selectedMotoboy, setSelectedMotoboy] = useState<Motoboy & { type?: 'fixo' | 'avulso' } | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('acerto');
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
    setAcertoDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  };

  const filteredMotoboys = useMemo(() => {
    return motoboys
      .filter(m => listFilter === 'ativos' ? m.active : !m.active)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [motoboys, listFilter]);

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
    setSelectedMotoboy(null); // Fecha ao suspender/reativar para atualizar a lista
    toast.success(newStatus ? 'Motoboy ativado!' : 'Motoboy suspenso!');
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
    
    // Detalhamento de entregas por Rota para o WhatsApp
    const routeBreakdown = todaysRoutes.map((r, i) => {
      const qty = todaysDeliveries.filter(d => d.route_id === r.id).length;
      return { index: i + 1, qty };
    });

    const totalDeliveries = todaysDeliveries.length;

    // Total em dinheiro físico recebido (Pedido + Troco real, conforme discutimos)
    const cashCollected = todaysDeliveries
      .filter(d => !d.is_paid && d.payment_method === 'dinheiro')
      .reduce((acc, curr) => acc + (curr.change_for ? curr.change_for : curr.value || 0), 0);

    const rule = selectedMotoboy.payment_rule || { type: 'fixed_plus_variable', fixed_amount: 100, threshold: 15, extra_fee: 7 };
    let motoboyFee = 0;
    let feeDescription = '';

    if (rule.type === 'fixed') {
      motoboyFee = rule.fixed_amount || 0;
      feeDescription = `Diária Fixa: R$ ${(rule.fixed_amount || 0).toFixed(2).replace('.', ',')}`;
    } else if (rule.type === 'per_delivery') {
      motoboyFee = totalDeliveries * (rule.delivery_fee || 0);
      feeDescription = `${totalDeliveries} entregas × R$ ${(rule.delivery_fee || 0).toFixed(2).replace('.', ',')}`;
    } else if (rule.type === 'fixed_plus_variable') {
      const fixed = rule.fixed_amount || 0;
      const threshold = rule.threshold || 0;
      const extraFee = rule.extra_fee || 0;
      if (totalDeliveries <= threshold) {
        motoboyFee = fixed;
        feeDescription = `Base (${totalDeliveries}/${threshold} entregas): R$ ${fixed.toFixed(2).replace('.', ',')}`;
      } else {
        const extraDeliveries = totalDeliveries - threshold;
        const extraAmount = extraDeliveries * extraFee;
        motoboyFee = fixed + extraAmount;
        feeDescription = `Base R$ ${fixed.toFixed(2).replace('.', ',')} + ${extraDeliveries} extra(s) × R$ ${extraFee.toFixed(2).replace('.', ',')}`;
      }
    }

    const totalVales = vales.reduce((acc, curr) => acc + curr.amount, 0);
    const liquidFeeToReceive = motoboyFee - totalVales;
    const netDifference = cashCollected - liquidFeeToReceive;
    
    // Se netDifference > 0: Motoboy tem que devolver dinheiro para loja.
    // Se netDifference < 0: Loja tem que pagar a diferença para ele (Pix/Dinheiro).
    const mustReturnToStore = netDifference > 0;
    const balanceAmount = Math.abs(netDifference);

    return { 
      totalDeliveries, 
      cashCollected, 
      motoboyFee, 
      feeDescription, 
      totalVales, 
      liquidFeeToReceive, 
      mustReturnToStore, 
      balanceAmount,
      routeBreakdown,
      todaysRoutesLength: todaysRoutes.length
    };
  }, [selectedMotoboy, acertoDate, routes, deliveries, vales]);

  const handleCopyWhatsApp = async () => {
    if (!selectedMotoboy || !acertoData) return;
    const [year, month, day] = acertoDate.split('-');
    
    let text = `🏍️ *FECHAMENTO DE CAIXA | DFL ENTREGAS*\n`;
    text += `👤 *Entregador:* ${selectedMotoboy.name}\n`;
    text += `📅 *Data:* ${day}/${month}/${year}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📦 *Entregas Realizadas:* ${acertoData.totalDeliveries}\n`;
    
    // Lista a quantidade de cada rota
    if (acertoData.routeBreakdown.length > 0) {
      text += `_(Detalhe: `;
      const breakdownText = acertoData.routeBreakdown.map(r => `Rota ${r.index}: ${r.qty}`).join(' | ');
      text += `${breakdownText})_\n`;
    }
    
    text += `\n🛵 *Comissão / Diária:*\n`;
    text += `   ↳ ${acertoData.feeDescription} = *R$ ${acertoData.motoboyFee.toFixed(2).replace('.', ',')}*\n`;
    
    if (vales.length > 0) {
      text += `\n➖ *Abatimentos / Vales:*\n`;
      vales.forEach(v => { 
        text += `   - ${v.description}: R$ ${v.amount.toFixed(2).replace('.', ',')}\n`; 
      });
      text += `   *Total Vales:* R$ ${acertoData.totalVales.toFixed(2).replace('.', ',')}\n`;
    }

    text += `   ↳ *Total Líquido da Diária:* R$ ${acertoData.liquidFeeToReceive.toFixed(2).replace('.', ',')}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `💵 *Dinheiro Recolhido do Cliente:* R$ ${acertoData.cashCollected.toFixed(2).replace('.', ',')}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━\n`;

    if (acertoData.mustReturnToStore) {
      text += `🔴 *ACERTO FINAL: MOTOBOY DEVOLVE AO CAIXA*\n`;
      text += `↳ *Valor a passar:* \`R$ ${acertoData.balanceAmount.toFixed(2).replace('.', ',')}\`\n`;
      text += `_(Dinheiro da rua menos sua diária líquida)_`;
    } else if (acertoData.balanceAmount === 0) {
      text += `🟢 *ACERTO FINAL: ZERADO*\n`;
      text += `↳ *Valor a receber/pagar:* \`R$ 0,00\`\n`;
      text += `_(O dinheiro recolhido pagou exatamente a sua diária)_`;
    } else {
      text += `🟢 *ACERTO FINAL: LOJA PAGA AO MOTOBOY*\n`;
      text += `↳ *Valor a receber:* \`R$ ${acertoData.balanceAmount.toFixed(2).replace('.', ',')}\`\n`;
      text += `_(Falta este valor para fechar sua diária)_`;
    }

    await navigator.clipboard.writeText(text);
    toast.success('Acerto copiado para o WhatsApp!');
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

  return (
    <div className="flex flex-col gap-6 relative pb-24 animate-in fade-in duration-300">
      <PageHeader title="Equipe de Motoboys" subtitle="Controle de rotas, frotas e comissões" to="/loja" />

      {/* NOVO MOTOBOY FORM */}
      {!isAdding ? (
        <button onClick={() => setIsAdding(true)} className="flex items-center justify-center gap-2 bg-zinc-900/40 border border-dashed border-zinc-700/80 text-zinc-400 rounded-2xl p-4 font-bold hover:bg-zinc-800 transition-colors cursor-pointer mx-2">
          <UserPlus size={18} /> Cadastrar Entregador
        </button>
      ) : (
        <div className="flex flex-col gap-3 p-5 mx-2 bg-zinc-900/60 border border-zinc-800 rounded-2xl animate-in slide-in-from-top-4">
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
                placeholder="Nome de Guerra (Ex: Bruno)" 
                value={newMotoboyName} 
                onChange={(e) => setNewMotoboyName(e.target.value)} 
                className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-zinc-100 focus:border-sky-500 focus:outline-none text-sm" 
                autoFocus
              />
            </div>
          </div>
          
          <div className="flex bg-zinc-950 border border-zinc-800 rounded-xl p-1 mt-1">
            <button type="button" onClick={() => setNewMotoboyType('fixo')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${newMotoboyType === 'fixo' ? 'bg-sky-500 text-zinc-950' : 'text-zinc-500'}`}>Fixo</button>
            <button type="button" onClick={() => setNewMotoboyType('avulso')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${newMotoboyType === 'avulso' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-500'}`}>Avulso</button>
          </div>

          <div className="flex gap-2 mt-2">
            <button onClick={handleAddMotoboy} className="flex-1 h-12 rounded-xl bg-sky-500 text-zinc-950 font-bold text-sm hover:bg-sky-400">Salvar Cadastro</button>
            <button onClick={() => setIsAdding(false)} className="h-12 px-6 rounded-xl bg-zinc-800 text-zinc-300 font-semibold text-sm hover:bg-zinc-700">Cancelar</button>
          </div>
        </div>
      )}

      {/* ABAS ATIVOS E INATIVOS */}
      <div className="px-2">
        <div className="flex bg-zinc-900/60 p-1 border border-zinc-800 rounded-[20px]">
          <button 
            onClick={() => setListFilter('ativos')}
            className={`flex-1 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${listFilter === 'ativos' ? 'bg-zinc-800 text-emerald-400 shadow-md' : 'text-zinc-500'}`}
          >
            <Users size={16} /> Entregadores Ativos ({motoboys.filter(m => m.active).length})
          </button>
          <button 
            onClick={() => setListFilter('inativos')}
            className={`flex-1 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${listFilter === 'inativos' ? 'bg-zinc-800 text-red-400 shadow-md' : 'text-zinc-500'}`}
          >
            <AlertTriangle size={16} /> Inativos ({motoboys.filter(m => !m.active).length})
          </button>
        </div>
      </div>

      {/* LISTA DE MOTOBOYS */}
      <div className="flex flex-col gap-3 px-2">
        {filteredMotoboys.length === 0 ? (
          <div className="py-16 text-center bg-zinc-900/30 border border-zinc-800/80 rounded-[28px]">
            <p className="text-zinc-500 font-medium text-sm">Nenhum motoboy {listFilter} no sistema.</p>
          </div>
        ) : (
          filteredMotoboys.map(m => {
            const type = (m as any).type || 'fixo';
            const avatarConfig = AVATAR_OPTIONS.find(a => a.id === m.avatar) || AVATAR_OPTIONS[0];
            
            return (
              <button 
                key={m.id} 
                onClick={() => openMotoboyPanel(m)}
                className="flex items-center justify-between p-4 rounded-[24px] border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900 transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <div className={`h-12 w-12 rounded-full flex items-center justify-center border ${m.active ? `${avatarConfig.bg} border-${avatarConfig.color.split('-')[1]}-500/20` : 'bg-zinc-950 border-zinc-800'}`}>
                    <RenderAvatarIcon id={m.avatar} size={22} className={!m.active ? 'text-zinc-600' : ''} />
                  </div>
                  
                  <div className="flex flex-col items-start gap-1">
                    <span className={`font-bold text-base ${!m.active ? 'text-zinc-500 line-through' : 'text-zinc-100'}`}>{m.name}</span>
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-extrabold uppercase ${!m.active ? 'bg-zinc-800 text-zinc-500 border border-zinc-700' : type === 'fixo' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30' : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'}`}>
                        {type}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-950 border border-zinc-800/80 text-zinc-400">
                  <Calculator size={18} />
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* ========================================================================================= */}
      {/* MODAL DE ACERTO DE CAIXA E REGRAS */}
      {/* ========================================================================================= */}
      {selectedMotoboy && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-zinc-950/95 backdrop-blur-xl animate-in slide-in-from-bottom-8 duration-300">
          <div className="flex items-center justify-between px-6 pb-4 pt-12 border-b border-zinc-800 bg-zinc-950 shrink-0">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                <RenderAvatarIcon id={selectedMotoboy.avatar} size={22} />
              </div>
              <div>
                <h2 className="text-xl font-black text-zinc-50">{selectedMotoboy.name}</h2>
                <p className="text-xs text-zinc-500 font-medium">Acerto e Regras</p>
              </div>
            </div>
            <button onClick={() => setSelectedMotoboy(null)} className="h-10 w-10 bg-zinc-900 rounded-full flex items-center justify-center text-zinc-400 hover:text-white active:scale-90">
              <X size={20} />
            </button>
          </div>

          <div className="flex px-4 pt-4 shrink-0 gap-2">
            <button onClick={() => setActiveTab('acerto')} className={`flex-1 flex justify-center items-center gap-2 py-3.5 rounded-2xl font-bold text-sm transition-all border ${activeTab === 'acerto' ? 'bg-zinc-900 border-zinc-700 text-emerald-400 shadow-md' : 'bg-zinc-950 border-transparent text-zinc-600'}`}><Receipt size={16} /> Acerto de Caixa</button>
            <button onClick={() => setActiveTab('config')} className={`flex-1 flex justify-center items-center gap-2 py-3.5 rounded-2xl font-bold text-sm transition-all border ${activeTab === 'config' ? 'bg-zinc-900 border-zinc-700 text-sky-400 shadow-md' : 'bg-zinc-950 border-transparent text-zinc-600'}`}><Settings size={16} /> Regras</button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pt-2 pb-12 flex flex-col gap-5 relative">
            {activeTab === 'acerto' && acertoData && (
              <div className="flex flex-col gap-4 animate-in fade-in">
                
                <div className="flex flex-col bg-zinc-900/80 border border-zinc-800 p-4 rounded-[24px]">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5"><CalendarDays size={14} className="text-emerald-500" /> Data do Acerto</span>
                    <button type="button" onClick={() => setAcertoDate(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`)} className="text-[10px] font-black px-3 py-1 rounded-full bg-zinc-800 text-zinc-300">Hoje</button>
                  </div>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => handleShiftDate(-1)} className="h-12 w-12 flex items-center justify-center bg-zinc-950 text-zinc-300 rounded-full border border-zinc-800 active:scale-95"><ChevronLeft size={20} /></button>
                    <div className="flex-1 h-12 flex items-center justify-center bg-zinc-950 border border-zinc-800 rounded-xl font-black text-zinc-100 text-sm tracking-widest">{(() => { const [y, m, d] = acertoDate.split('-'); return `${d}/${m}/${y}`; })()}</div>
                    <button type="button" onClick={() => handleShiftDate(1)} className="h-12 w-12 flex items-center justify-center bg-zinc-950 text-zinc-300 rounded-full border border-zinc-800 active:scale-95"><ChevronRight size={20} /></button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-[24px] flex flex-col gap-1.5">
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-widest"><Package size={12} className="text-sky-400" /> Roteamento</span>
                    <span className="text-2xl font-black text-zinc-100">{acertoData.totalDeliveries} <span className="text-[11px] font-bold text-zinc-500 uppercase">entregas</span></span>
                    <span className="text-[10px] text-zinc-500">{acertoData.todaysRoutesLength} {acertoData.todaysRoutesLength === 1 ? 'rota concluída' : 'rotas concluídas'}</span>
                  </div>
                  <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-[24px] flex flex-col gap-1.5">
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-amber-500 uppercase tracking-widest"><Banknote size={12} /> Dinheiro na Bag</span>
                    <span className="text-2xl font-black text-amber-400">R$ {acertoData.cashCollected.toFixed(2).replace('.', ',')}</span>
                    <span className="text-[10px] text-zinc-500">Recolhido em espécie</span>
                  </div>
                </div>

                <div className="bg-sky-500/5 border border-sky-500/20 p-5 rounded-[24px] flex flex-col gap-2">
                  <span className="flex items-center gap-1.5 text-[10px] font-black text-sky-500 uppercase tracking-widest"><Calculator size={14} /> Diária do Entregador</span>
                  <div className="flex items-end justify-between border-b border-sky-500/10 pb-3">
                    <p className="text-[11px] font-bold text-zinc-400 leading-relaxed max-w-[60%]">{acertoData.feeDescription}</p>
                    <span className="text-2xl font-black text-sky-400">R$ {acertoData.motoboyFee.toFixed(2).replace('.', ',')}</span>
                  </div>
                  
                  {vales.length > 0 && (
                    <div className="flex flex-col gap-2 pt-2">
                      <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Descontos / Vales</span>
                      {vales.map(v => (
                        <div key={v.id} className="flex justify-between items-center text-xs text-red-300 font-semibold px-2">
                          <span>{v.description}</span>
                          <div className="flex items-center gap-3">
                            <span>- R$ {v.amount.toFixed(2).replace('.', ',')}</span>
                            <button onClick={()=>setVales(vales.filter(x => x.id !== v.id))} className="text-red-500/50 hover:text-red-500 active:scale-90"><Trash2 size={12}/></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between pt-2">
                     <span className="text-[11px] font-black text-sky-400 uppercase">Diária Líquida a Receber</span>
                     <span className="text-sm font-black text-sky-400">R$ {acertoData.liquidFeeToReceive.toFixed(2).replace('.', ',')}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-2">Lançar Novo Vale</h3>
                  <div className="flex items-center gap-2 w-full bg-zinc-900 border border-zinc-800 p-2 rounded-2xl">
                    <input type="text" placeholder="Ex: Lanche, Gasolina" value={valeDesc} onChange={(e)=>setValeDesc(e.target.value)} className="flex-[2] min-w-0 h-12 bg-transparent px-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600" />
                    <div className="w-px h-6 bg-zinc-800 shrink-0"/>
                    <input type="text" placeholder="R$ 0,00" value={valeAmount} onChange={(e)=>setValeAmount(formatCurrencyInput(e.target.value))} className="flex-1 min-w-0 h-12 bg-transparent px-3 text-sm text-amber-500 font-bold outline-none placeholder:text-amber-500/30 text-right" />
                    <button onClick={handleAddVale} className="h-12 w-12 shrink-0 flex items-center justify-center bg-zinc-800 rounded-xl text-zinc-300 active:scale-95 transition-all"><PlusCircle size={20}/></button>
                  </div>
                </div>

                <div className={`mt-2 p-5 rounded-[28px] flex flex-col gap-1 shadow-lg ${
                  acertoData.mustReturnToStore 
                    ? 'bg-amber-500 border border-amber-400' 
                    : acertoData.balanceAmount === 0 
                      ? 'bg-zinc-800 border border-zinc-700'
                      : 'bg-emerald-500 border border-emerald-400'
                }`}>
                  <span className={`text-[10px] font-black uppercase tracking-widest flex items-center justify-between ${acertoData.balanceAmount === 0 ? 'text-zinc-400' : 'text-zinc-900/60'}`}>
                    Resultado do Fechamento
                    {acertoData.mustReturnToStore ? <ArrowDownLeft size={16} /> : acertoData.balanceAmount === 0 ? <Check size={16}/> : <ArrowUpRight size={16} />}
                  </span>
                  
                  <span className={`text-[32px] font-black tracking-tight ${acertoData.balanceAmount === 0 ? 'text-zinc-100' : 'text-zinc-950'}`}>
                    R$ {acertoData.balanceAmount.toFixed(2).replace('.', ',')}
                  </span>
                  
                  <span className={`text-[11px] font-bold mt-1 ${acertoData.balanceAmount === 0 ? 'text-zinc-400' : 'text-zinc-900/80'}`}>
                    {acertoData.mustReturnToStore 
                      ? `MOTOBOY DEVOLVE À LOJA` 
                      : acertoData.balanceAmount === 0
                        ? `CAIXA ZERADO (DIÁRIA PAGA)`
                        : `LOJA PAGA AO MOTOBOY`}
                  </span>
                </div>

                <button onClick={handleCopyWhatsApp} className="w-full flex items-center justify-center gap-2 h-14 bg-zinc-100 hover:bg-white rounded-xl font-black text-zinc-950 text-sm shadow-xl active:scale-95 transition-all mt-4 mb-8">
                  <Send size={16} /> Copiar Acerto p/ WhatsApp
                </button>
              </div>
            )}

            {/* TAB CONFIG (Regras) */}
            {activeTab === 'config' && (
              <form onSubmit={handleSaveConfig} className="flex flex-col gap-5 animate-in fade-in">
                
                <div className="flex items-center gap-4 bg-zinc-900/50 p-5 rounded-[24px] border border-zinc-800">
                  <button type="button" onClick={() => openAvatarPicker('edit')} className="relative h-16 w-16 rounded-full bg-zinc-950 border border-zinc-700 flex items-center justify-center hover:bg-zinc-800 group overflow-hidden shrink-0 transition-transform active:scale-95">
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 z-10 transition-opacity"><Camera size={18} className="text-white" /></div>
                    <RenderAvatarIcon id={editAvatar} size={28} />
                  </button>
                  <div className="flex flex-col">
                    <span className="text-base font-bold text-zinc-100">Avatar do Entregador</span>
                    <span className="text-[11px] text-zinc-500 font-medium mt-0.5">Toque para personalizar a foto</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-2">Tipo de Contrato</label>
                  <div className="flex bg-zinc-900 p-1 rounded-2xl border border-zinc-800">
                    <button type="button" onClick={() => setEditType('fixo')} className={`flex-1 h-12 rounded-[14px] font-bold text-sm flex items-center justify-center gap-2 transition-all ${editType === 'fixo' ? 'bg-sky-500 text-sky-950 shadow-md' : 'text-zinc-500'}`}>{editType === 'fixo' && <Check size={16} />} Fixo</button>
                    <button type="button" onClick={() => setEditType('avulso')} className={`flex-1 h-12 rounded-[14px] font-bold text-sm flex items-center justify-center gap-2 transition-all ${editType === 'avulso' ? 'bg-amber-500 text-amber-950 shadow-md' : 'text-zinc-500'}`}>{editType === 'avulso' && <Check size={16} />} Avulso</button>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-2">Cálculo de Diária</label>
                  <div className="flex flex-col gap-2 bg-zinc-900 p-2 rounded-2xl border border-zinc-800">
                    {[
                      { id: 'fixed_plus_variable', label: 'Fixo Mínimo + Entregas Extra' },
                      { id: 'per_delivery', label: 'Ganha Apenas por Entrega' },
                      { id: 'fixed', label: 'Apenas Diária Fixa' },
                    ].map((item) => (
                      <button key={item.id} type="button" onClick={() => setRuleType(item.id as PaymentRuleType)} className={`flex items-center justify-between p-4 rounded-[14px] text-left font-bold text-xs transition-all ${ruleType === item.id ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>
                        {item.label}
                        {ruleType === item.id && <Check size={16} className="text-emerald-400" />}
                      </button>
                    ))}
                  </div>
                </div>

                {ruleType === 'fixed_plus_variable' && (
                  <div className="grid grid-cols-2 gap-3 bg-zinc-900/60 p-4 rounded-[24px] border border-zinc-800">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Base Fixa (R$)</label>
                      <input type="text" value={ruleFixedAmount} onChange={e => setRuleFixedAmount(formatCurrencyInput(e.target.value))} placeholder="Ex: 50,00" className="h-14 rounded-[14px] bg-zinc-950 border border-zinc-800 px-4 text-zinc-100 text-sm font-bold focus:border-sky-500 outline-none" required />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Até Quantas?</label>
                      <input type="number" value={ruleThreshold} onChange={e => setRuleThreshold(e.target.value)} placeholder="Ex: 15" className="h-14 rounded-[14px] bg-zinc-950 border border-zinc-800 px-4 text-zinc-100 text-sm font-bold focus:border-sky-500 outline-none" required />
                    </div>
                    <div className="flex flex-col gap-1.5 col-span-2 pt-2 border-t border-zinc-800/80">
                      <label className="text-[10px] font-bold text-sky-400 uppercase tracking-widest flex items-center gap-1.5"><TrendingUp size={12}/> Taxa por entrega extra (R$)</label>
                      <input type="text" value={ruleExtraFee} onChange={e => setRuleExtraFee(formatCurrencyInput(e.target.value))} placeholder="Ex: 6,50" className="h-14 rounded-[14px] bg-zinc-950 border border-zinc-800 px-4 text-sky-400 text-base font-black focus:border-sky-500 outline-none" required />
                    </div>
                  </div>
                )}
                
                {ruleType === 'per_delivery' && (
                  <div className="bg-zinc-900/60 p-4 rounded-[24px] border border-zinc-800 flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-sky-400 uppercase tracking-widest flex items-center gap-1.5"><Package size={12}/> Valor Pago por Entrega (R$)</label>
                    <input type="text" value={ruleDeliveryFee} onChange={e => setRuleDeliveryFee(formatCurrencyInput(e.target.value))} placeholder="Ex: 7,00" className="h-14 rounded-[14px] bg-zinc-950 border border-zinc-800 px-4 text-sky-400 text-base font-black focus:border-sky-500 outline-none" required />
                  </div>
                )}

                {ruleType === 'fixed' && (
                  <div className="bg-zinc-900/60 p-4 rounded-[24px] border border-zinc-800 flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-amber-500 uppercase tracking-widest flex items-center gap-1.5"><Calculator size={12}/> Valor da Diária (R$)</label>
                    <input type="text" value={ruleFixedAmount} onChange={e => setRuleFixedAmount(formatCurrencyInput(e.target.value))} placeholder="Ex: 120,00" className="h-14 rounded-[14px] bg-zinc-950 border border-zinc-800 px-4 text-amber-400 text-base font-black focus:border-amber-500 outline-none" required />
                  </div>
                )}

                <button type="submit" className="h-14 w-full rounded-2xl bg-zinc-100 font-black text-zinc-950 active:scale-[0.98] mt-2 text-sm transition-all shadow-xl">
                  Salvar Regras
                </button>

                <div className="border-t border-zinc-800 pt-6 mt-4 pb-12">
                  <button type="button" onClick={toggleActive} className={`flex justify-center items-center gap-2 h-14 w-full rounded-2xl border font-bold text-xs active:scale-95 transition-all ${selectedMotoboy.active ? 'border-red-500/30 text-red-500 hover:bg-red-500/10' : 'border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10'}`}>
                    <ShieldCheck size={16} />{selectedMotoboy.active ? 'Desativar / Suspender Contrato' : 'Reativar Entregador'}
                  </button>
                  <p className="text-center text-[10px] text-zinc-600 mt-3 px-8">Ao desativar, o motoboy não aparecerá nas opções de montagem de rota, mas o histórico permanece.</p>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL DE ESCOLHA DE AVATAR */}
      {isAvatarModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-[32px] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-zinc-50">Escolha o Avatar</h3>
              <button onClick={() => setIsAvatarModalOpen(false)} className="text-zinc-500 bg-zinc-900 p-2 rounded-full hover:text-zinc-300"><X size={18}/></button>
            </div>
            
            <div className="grid grid-cols-4 gap-3">
              {AVATAR_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => {
                    if (avatarTarget === 'new') setNewMotoboyAvatar(opt.id);
                    else setEditAvatar(opt.id);
                    setIsAvatarModalOpen(false);
                  }}
                  className={`flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border transition-all active:scale-95 ${
                    (avatarTarget === 'new' ? newMotoboyAvatar : editAvatar) === opt.id
                      ? `bg-zinc-800 border-zinc-500 shadow-md`
                      : `bg-zinc-900 border-zinc-800/80 hover:bg-zinc-800`
                  }`}
                >
                  <div className={`h-11 w-11 rounded-full flex items-center justify-center ${opt.bg}`}>
                    <RenderAvatarIcon id={opt.id} size={22} />
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