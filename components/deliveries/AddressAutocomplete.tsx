'use client';

import { Mic } from 'lucide-react';
import { toast } from 'sonner';

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}

export function AddressAutocomplete({ 
  value, 
  onChange, 
  placeholder = "Ex: Rua das Flores, 123",
  label = "Rua e Número*" 
}: AddressAutocompleteProps) {
  
  // Como removemos a API do Google, o botão de microfone serve como um
  // atalho visual para lembrar o usuário de usar o ditado nativo do teclado.
  const handleMicClick = () => {
    toast.info('Use o microfone do seu teclado 🎤', {
      description: 'Toque no campo e pressione o ícone de microfone no teclado do celular para ditar o endereço.'
    });
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-zinc-400">{label}</label>
        </div>
      )}
      
      <div className="relative flex items-center">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-14 w-full rounded-2xl border border-zinc-800 bg-zinc-900/50 pl-4 pr-14 text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none transition-colors"
        />
        
        <button
          type="button"
          onClick={handleMicClick}
          className="absolute right-2 flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800 text-zinc-400 hover:text-emerald-400 active:scale-95 transition-all cursor-pointer"
          title="Ditar endereço"
        >
          <Mic size={18} />
        </button>
      </div>
    </div>
  );
}
