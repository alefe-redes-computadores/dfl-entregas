import { PiggyBank } from 'lucide-react';

interface BossSavingsCardProps {
  deliveriesCount: number;
  savedAmount: number;
}

export function BossSavingsCard({ deliveriesCount, savedAmount }: BossSavingsCardProps) {
  if (deliveriesCount === 0) return null;

  return (
    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-[24px] p-5 flex items-center justify-between shadow-sm animate-in fade-in">
      <div className="flex flex-col">
        <span className="flex items-center gap-1.5 text-emerald-500 font-bold text-xs uppercase tracking-wider">
          <PiggyBank size={16} /> Economia (A Pé)
        </span>
        <span className="text-3xl font-black text-emerald-400 mt-1">
          R$ {savedAmount.toFixed(2).replace('.', ',')}
        </span>
        <span className="text-xs text-emerald-500/70 mt-1 font-medium">
          {deliveriesCount} {deliveriesCount === 1 ? 'entrega realizada' : 'entregas realizadas'} por você
        </span>
      </div>
    </div>
  );
}
