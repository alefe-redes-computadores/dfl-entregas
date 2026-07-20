'use client';

import { useAppStore } from '@/store/useAppStore';
import { PackageCheck, Bike, TrendingUp } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export default function RelatoriosPage() {
  const deliveries = useAppStore((state) => state.deliveries);
  const routes = useAppStore((state) => state.routes);

  // Cálculos Básicos
  const totalEntregas = deliveries.length;
  const rotasFinalizadas = routes.filter(r => r.status === 'fechada').length;

  // Contagem de formas de pagamento
  const paymentCounts = deliveries.reduce((acc, curr) => {
    acc[curr.payment_method] = (acc[curr.payment_method] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const dataPie = [
    { name: 'Dinheiro', value: paymentCounts['dinheiro'] || 0, color: '#f59e0b' }, // Amber-500
    { name: 'Pix', value: paymentCounts['pix'] || 0, color: '#10b981' }, // Emerald-500
    { name: 'Crédito', value: paymentCounts['cartao_credito'] || 0, color: '#38bdf8' }, // Sky-400
    { name: 'Débito', value: paymentCounts['cartao_debito'] || 0, color: '#818cf8' }, // Indigo-400
  ].filter(d => d.value > 0);

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-bold text-zinc-50">Relatórios</h1>
        <p className="text-sm text-zinc-500">Análise logística do período.</p>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-3 rounded-[24px] border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
            <PackageCheck size={20} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Entregas</p>
            <p className="font-heading text-2xl font-bold text-zinc-50">{totalEntregas}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-[24px] border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/15 text-amber-500">
            <Bike size={20} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Rotas Fechadas</p>
            <p className="font-heading text-2xl font-bold text-zinc-50">{rotasFinalizadas}</p>
          </div>
        </div>
      </div>

      {/* Gráfico de Pagamentos */}
      <div className="flex flex-col gap-4 rounded-[28px] border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-zinc-100">Formas de Pagamento</h2>
          <TrendingUp size={16} className="text-zinc-500" />
        </div>

        {totalEntregas === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-zinc-600">
            Sem dados para exibir
          </div>
        ) : (
          <>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dataPie}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {dataPie.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '16px', color: '#fafafa' }}
                    itemStyle={{ color: '#fafafa' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legenda customizada */}
            <div className="flex flex-wrap justify-center gap-4 pt-2">
              {dataPie.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs text-zinc-400">{item.name} ({item.value})</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
