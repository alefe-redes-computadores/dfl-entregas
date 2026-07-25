'use client';

import { useEffect, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { MapPin, Maximize2, Minimize2 } from 'lucide-react';

interface NeighborhoodChartProps {
  data: Array<{ name: string; count: number; }>;
}

export function NeighborhoodChart({ data }: NeighborhoodChartProps) {
  const [mounted, setMounted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted || data.length === 0) return null;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-zinc-900/95 border border-zinc-700/50 rounded-xl p-3 backdrop-blur-sm shadow-lg">
          <p className="text-sm font-bold text-zinc-200">{label}</p>
          <p className="text-sm font-bold text-purple-500">{`${payload[0].value} entregas`}</p>
        </div>
      );
    }
    return null;
  };

  const sortedData = [...data].sort((a, b) => b.count - a.count).slice(0, 10);

  const ChartContent = (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-purple-500" />
          <h3 className="text-lg font-bold text-zinc-200">Top Bairros</h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider bg-zinc-800/50 px-2 py-1 rounded">Top 10</span>
          <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 bg-zinc-800 rounded-full hover:bg-zinc-700 transition-colors text-zinc-400">
            {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>
      
      {/* Quando expandido, ele usa a tela toda, quando não, usa 300px */}
      <ResponsiveContainer width="100%" height={isExpanded ? '85%' : 300}>
        <BarChart data={sortedData} layout="vertical" margin={{ top: 10, right: 20, left: 40, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
          <XAxis type="number" stroke="#71717a" tick={{ fill: '#71717a', fontSize: 12 }} hide />
          <YAxis 
            type="category" 
            dataKey="name" 
            stroke="#71717a" 
            tick={{ fill: '#e4e4e7', fontSize: 12, fontWeight: 500 }} 
            tickLine={false}
            axisLine={false}
            width={100} 
          />
          <Tooltip content={<CustomTooltip />} cursor={{fill: '#27272a', opacity: 0.4}} />
          <Bar dataKey="count" fill="#8b5cf6" radius={[0, 8, 8, 0]} animationDuration={1500} barSize={isExpanded ? 30 : 15} />
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
