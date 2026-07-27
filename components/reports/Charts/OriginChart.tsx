'use client';

import { useEffect, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Smartphone, Maximize2, Minimize2, TrendingUp } from 'lucide-react';

interface OriginChartProps {
  data: Array<{ origin: string; count: number; total: number }>;
}

export function OriginChart({ data }: OriginChartProps) {
  const [mounted, setMounted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted || data.length === 0) return null;

  const formattedData = data.map(item => ({
    name: item.origin === 'ifood' ? 'iFood' : 'Loja Própria',
    entregas: item.count,
    faturamento: item.total
  }));

  const totalEntregas = formattedData.reduce((acc, curr) => acc + curr.entregas, 0);
  const ifoodData = formattedData.find(d => d.name === 'iFood');
  const ifoodPercent = totalEntregas > 0 ? Math.round((ifoodData?.entregas || 0) / totalEntregas * 100) : 0;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-zinc-900/95 border border-zinc-700/50 rounded-xl p-3 backdrop-blur-sm shadow-lg">
          <p className="text-sm font-bold text-zinc-200 mb-2">{label}</p>
          <p className="text-sm text-red-400 font-semibold">{`${payload[0].value} Entregas`}</p>
          <p className="text-sm text-emerald-400 font-semibold">{`R$ ${payload[1].value.toFixed(2)}`}</p>
        </div>
      );
    }
    return null;
  };

  const ChartContent = (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-red-500" />
          <h3 className="text-lg font-bold text-zinc-200">Canais de Venda</h3>
        </div>
        <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 bg-zinc-800 rounded-full hover:bg-zinc-700 transition-colors text-zinc-400">
          {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>

      <ResponsiveContainer width="100%" height={isExpanded ? '60%' : 240}>
        <BarChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis dataKey="name" stroke="#71717a" tick={{ fill: '#e4e4e7', fontSize: 13, fontWeight: 600 }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="left" orientation="left" stroke="#71717a" tick={{ fill: '#71717a', fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="right" orientation="right" stroke="#71717a" tick={{ fill: '#71717a', fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#27272a', opacity: 0.4 }} />
          <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px', color: '#a1a1aa' }} />
          
          <Bar yAxisId="left" dataKey="entregas" name="Qtd Entregas" fill="#ef4444" radius={[6, 6, 0, 0]} barSize={40} />
          <Bar yAxisId="right" dataKey="faturamento" name="Faturamento (R$)" fill="#10b981" radius={[6, 6, 0, 0]} barSize={40} />
        </BarChart>
      </ResponsiveContainer>

      {/* CARD DE INSIGHT INTELIGENTE */}
      <div className="mt-4 p-4 rounded-2xl bg-zinc-800/40 border border-zinc-700/50 flex items-start gap-3">
        <TrendingUp className="text-sky-400 shrink-0 mt-0.5" size={20} />
        <p className="text-sm text-zinc-300 leading-relaxed">
          Neste período, <strong className="text-zinc-100">{ifoodPercent > 50 ? 'o iFood' : 'a Loja Própria'}</strong> representou <strong className="text-sky-400">{ifoodPercent > 50 ? ifoodPercent : 100 - ifoodPercent}%</strong> do volume total de pedidos.
        </p>
      </div>
    </>
  );

  if (isExpanded) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950/95 backdrop-blur-md p-6 animate-in fade-in duration-200">
        <div className="w-full h-full max-w-2xl mx-auto flex flex-col pt-10">
          {ChartContent}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-[24px] p-6 shadow-sm">
      {ChartContent}
    </div>
  );
}
