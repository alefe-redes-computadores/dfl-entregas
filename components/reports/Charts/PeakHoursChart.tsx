'use client';

import { useEffect, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Clock } from 'lucide-react';

interface PeakHoursChartProps {
  data: Array<{ hour: string; count: number }>;
}

export function PeakHoursChart({ data }: PeakHoursChartProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted || data.length === 0) return null;

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-[24px] p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-5 h-5 text-sky-400" />
        <h3 className="text-lg font-bold text-zinc-200">Horários de Maior Movimento</h3>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis dataKey="hour" stroke="#71717a" tick={{ fill: '#a1a1aa', fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis stroke="#71717a" tick={{ fill: '#71717a', fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip 
            cursor={{ fill: '#27272a', opacity: 0.4 }}
            contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px', color: '#fff', fontWeight: 'bold' }}
            formatter={(value: number) => [`${value} pedidos`, 'Volume']}
            labelStyle={{ color: '#a1a1aa', marginBottom: '4px' }}
          />
          <Bar dataKey="count" fill="#38bdf8" radius={[4, 4, 0, 0]} barSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
