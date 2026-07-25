'use client';

import { useEffect, useState } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { CreditCard, Maximize2, Minimize2 } from 'lucide-react';

interface PaymentChartProps {
  data: Array<{ method: string; count: number; total: number; }>;
}

export function PaymentChart({ data }: PaymentChartProps) {
  const [mounted, setMounted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false); // Magia da tela cheia

  useEffect(() => setMounted(true), []);

  if (!mounted || data.length === 0) return null;

  const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899'];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-zinc-900/95 border border-zinc-700/50 rounded-xl p-3 backdrop-blur-sm shadow-lg">
          <p className="text-sm font-bold text-zinc-200">{data.method}</p>
          <p className="text-sm text-zinc-400">{`${data.count} entregas`}</p>
          <p className="text-sm font-bold text-emerald-500">{`R$ ${data.total.toFixed(2)}`}</p>
        </div>
      );
    }
    return null;
  };

  const ChartContent = (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-amber-500" />
          <h3 className="text-lg font-bold text-zinc-200">Formas de Pagamento</h3>
        </div>
        <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 bg-zinc-800 rounded-full hover:bg-zinc-700 transition-colors text-zinc-400">
          {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>
      
      <ResponsiveContainer width="100%" height={isExpanded ? '80%' : 300}>
        <PieChart>
          <Pie
            data={data}
            nameKey="method" // MATADOR DE BUGS: Ensina o Recharts a ler a palavra certa!
            dataKey="count"
            cx="50%"
            cy="50%"
            innerRadius={isExpanded ? 100 : 60}
            outerRadius={isExpanded ? 140 : 80}
            paddingAngle={5}
            animationDuration={1500}
            label={({ method, percent }) => `${method} ${(percent * 100).toFixed(0)}%`} // Escreve direto na tela!
            labelLine={false}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ color: '#a1a1aa', fontSize: 14, paddingTop: 20 }} />
        </PieChart>
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
