'use client';

import { useEffect, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Clock, Maximize2, Minimize2 } from 'lucide-react';

interface PeakHoursChartProps {
  data: Array<{ hour: string; count: number }>;
}

export function PeakHoursChart({ data }: PeakHoursChartProps) {
  const [mounted, setMounted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted || data.length === 0) return null;

  const ChartContent = (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-sky-400" />
          <h3 className="text-lg font-bold text-zinc-200">Horários de Pico</h3>
        </div>
        <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 bg-zinc-800 rounded-full hover:bg-zinc-700 transition-colors text-zinc-400">
          {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>
      <ResponsiveContainer width="100%" height={isExpanded ? '80%' : 220}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis dataKey="hour" stroke="#71717a" tick={{ fill: '#e4e4e7', fontSize: 12, fontWeight: 500 }} axisLine={false} tickLine={false} />
          <YAxis stroke="#71717a" tick={{ fill: '#71717a', fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip 
            cursor={{ fill: '#27272a', opacity: 0.4 }}
            contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px', color: '#fff', fontWeight: 'bold' }}
            formatter={(value: number) => [`${value} pedidos`, 'Volume']}
            labelStyle={{ color: '#38bdf8', marginBottom: '4px' }}
          />
          <Bar dataKey="count" fill="#38bdf8" radius={[4, 4, 0, 0]} barSize={24} animationDuration={1000} />
        </BarChart>
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
