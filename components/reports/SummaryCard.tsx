// components/reports/SummaryCard.tsx
'use client';

import { ReactNode } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface SummaryCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  variation?: number;
  accentColor?: 'emerald' | 'amber' | 'blue' | 'purple' | 'pink';
  delay?: number;
}

export function SummaryCard({ 
  title, 
  value, 
  subtitle, 
  icon, 
  variation, 
  accentColor = 'emerald',
  delay = 0 
}: SummaryCardProps) {
  const colorClasses = {
    emerald: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/20',
    amber: 'from-amber-500/20 to-amber-600/10 border-amber-500/20',
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/20',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/20',
    pink: 'from-pink-500/20 to-pink-600/10 border-pink-500/20',
  };

  const iconColors = {
    emerald: 'text-emerald-500',
    amber: 'text-amber-500',
    blue: 'text-blue-500',
    purple: 'text-purple-500',
    pink: 'text-pink-500',
  };

  return (
    <div 
      className={`bg-gradient-to-br ${colorClasses[accentColor]} border rounded-xl p-4 backdrop-blur-sm animate-fadeInUp`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="text-zinc-400 text-sm font-medium">{title}</div>
        <div className={`${iconColors[accentColor]}`}>{icon}</div>
      </div>
      
      <div className="text-2xl font-bold text-zinc-100">
        {value}
      </div>
      
      {subtitle && (
        <div className="text-xs text-zinc-400 mt-1">{subtitle}</div>
      )}
      
      {variation !== undefined && variation !== 0 && (
        <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${variation > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
          {variation > 0 ? (
            <TrendingUp className="w-3 h-3" />
          ) : (
            <TrendingDown className="w-3 h-3" />
          )}
          <span>{Math.abs(variation)}%</span>
          <span className="text-zinc-400">vs mês anterior</span>
        </div>
      )}
    </div>
  );
}