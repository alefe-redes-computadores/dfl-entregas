'use client';

import { useEffect, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Smartphone, Store } from 'lucide-react';

interface OriginChartProps {
  data: Array<{ origin: string; count: number; total: number }>;
}

export function OriginChart({ data }: OriginChartProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted || data.length === 0) return null;

  const formattedData = data.map(item => ({
    name: item.origin === 'ifood' ? 'iFood' : 'Loja Própria',
    entregas: item.count,
    faturamento: item.total
  }));

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-[24px] p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Smartphone className="w-5 h-5 text-red-500" />
        <h3 className="text-lg font-bold text-zinc-200">Canais de Venda (iFood vs Loja)</h3>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={formattedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis dataKey="name" stroke="#71717a" tick={{ fill: '#e4e4e7', fontSize: 13, fontWeight: 600 }} />
          <YAxis stroke="#71717a" tick={{ fill: '#71717a', fontSize: 12 }} />
          <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px', color: '#fff' }} />
          <Bar dataKey="entregas" name="Qtd Entregas" fill="#ef4444" radius={[6, 6, 0, 0]} barSize={40} />
          <Bar dataKey="faturamento" name="Faturamento (R$)" fill="#10b981" radius={[6, 6, 0, 0]} barSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
