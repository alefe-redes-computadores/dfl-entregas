'use client';

import { useEffect, useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Calendar, Maximize2, Minimize2 } from 'lucide-react';

interface DailyEvolutionChartProps {
  data: Array<{ day: number; date: string; deliveries: number; revenue: number; }>;
  onSelectDay?: (dayData: { day: number; date: string }) => void; // A mágica do Drill-down
}

export function DailyEvolutionChart({ data, onSelectDay }: DailyEvolutionChartProps) {
  const [mounted, setMounted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted || data.length === 0) return null;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-zinc-900/95 border border-zinc-700/50 rounded-xl p-3 backdrop-blur-sm shadow-lg pointer-events-none">
          <p className="text-sm font-bold text-emerald-400 mb-1">{`Dia ${label} (Toque para ver detalhes)`}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.name === 'Entregas' ? entry.value : `R$ ${entry.value.toFixed(2)}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const handleClick = (e: any) => {
    if (e && e.activePayload && e.activePayload.length > 0) {
      const clickedData = e.activePayload[0].payload;
      if (onSelectDay) {
        onSelectDay({ day: clickedData.day, date: clickedData.date });
      }
    }
  };

  const ChartContent = (
    <>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-emerald-500" />
          <div>
            <h3 className="text-lg font-bold text-zinc-200">Evolução Diária</h3>
            <p className="text-xs text-zinc-500">Toque em qualquer dia para inspecionar as entregas</p>
          </div>
        </div>
        <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 bg-zinc-800 rounded-full hover:bg-zinc-700 transition-colors text-zinc-400">
          {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>
      
      <ResponsiveContainer width="100%" height={isExpanded ? '80%' : 280}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} onClick={handleClick} style={{ cursor: 'pointer' }}>
          <defs>
            <linearGradient id="deliveriesGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis dataKey="day" stroke="#71717a" tick={{ fill: '#71717a', fontSize: 12 }} />
          <YAxis stroke="#71717a" tick={{ fill: '#71717a', fontSize: 12 }} yAxisId="left" orientation="left" />
          <YAxis stroke="#71717a" tick={{ fill: '#71717a', fontSize: 12 }} yAxisId="right" orientation="right" />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ color: '#a1a1aa', fontSize: 12, paddingTop: 10 }} />
          <Area yAxisId="left" type="monotone" dataKey="deliveries" name="Entregas" stroke="#10b981" strokeWidth={2.5} fill="url(#deliveriesGradient)" />
          <Area yAxisId="right" type="monotone" dataKey="revenue" name="Faturamento" stroke="#f59e0b" strokeWidth={2.5} fill="url(#revenueGradient)" />
        </AreaChart>
      </ResponsiveContainer>
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
