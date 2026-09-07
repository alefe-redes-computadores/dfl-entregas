// components/deliveries/AddressAutocomplete.tsx
'use client';

import { ClipboardPaste, MapPin, Mic, X } from 'lucide-react';
import { toast } from 'sonner';

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  onMapsLinkDetected?: (url: string) => void;
  localityHint?: string;
}

const GOOGLE_MAPS_URL =
  /https?:\/\/(?:www\.)?(?:google\.[^/\s]+\/maps|maps\.app\.goo\.gl)\/\S+/i;

const normalizeInput = (raw: string) =>
  raw
    .replace(/\r?\n+/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/,\s*,+/g, ', ')
    .trim();

export function AddressAutocomplete({
  value,
  onChange,
  placeholder = 'Ex: Rua Zeca Mota, 123 — Alvorada',
  label = 'Rua e Número*',
  onMapsLinkDetected,
  localityHint = 'Patos de Minas · MG',
}: AddressAutocompleteProps) {
  const hasAddress = value.trim().length > 0;
  const hasNumber = /\d+/.test(value);

  const handleMicClick = () => {
    toast.info('Use o ditado do teclado', {
      description: 'Toque no campo e use o microfone do teclado do celular.',
    });
  };

  const handlePaste = async () => {
    try {
      const clipboard = await navigator.clipboard.readText();
      const text = clipboard.trim();

      if (!text) {
        toast.info('A área de transferência está vazia.');
        return;
      }

      const mapsMatch = text.match(GOOGLE_MAPS_URL);

      if (mapsMatch && onMapsLinkDetected) {
        onMapsLinkDetected(mapsMatch[0]);

        const withoutLink = normalizeInput(text.replace(mapsMatch[0], ''));
        if (withoutLink) onChange(withoutLink);

        toast.success('Link do Maps identificado', {
          description: 'A referência foi vinculada à entrega.',
        });
        return;
      }

      onChange(normalizeInput(text));
      toast.success('Endereço colado.');
    } catch {
      toast.error('Não foi possível acessar a área de transferência.');
    }
  };

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-end justify-between gap-3">
        <div>
          {label && (
            <label className="text-sm font-semibold text-zinc-400">{label}</label>
          )}
          <p className="mt-0.5 text-[10px] font-medium text-zinc-600">{localityHint}</p>
        </div>

        {hasAddress && (
          <span
            className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-wide ${
              hasNumber
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                : 'border-amber-500/20 bg-amber-500/10 text-amber-400'
            }`}
          >
            {hasNumber ? 'Rua + número' : 'Falta número'}
          </span>
        )}
      </div>

      <div className="relative flex items-center">
        <MapPin
          size={17}
          className={`pointer-events-none absolute left-4 ${
            hasAddress ? 'text-emerald-400' : 'text-zinc-600'
          }`}
        />

        <input
          type="text"
          inputMode="text"
          autoComplete="street-address"
          value={value}
          onChange={(event) => onChange(normalizeInput(event.target.value))}
          placeholder={placeholder}
          className="h-14 w-full rounded-2xl border border-zinc-800 bg-zinc-900/50 pl-11 pr-24 text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none transition-colors"
        />

        <div className="absolute right-2 flex items-center gap-1">
          {hasAddress && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-zinc-600 transition-all active:scale-95 active:bg-zinc-800"
              aria-label="Limpar endereço"
              title="Limpar endereço"
            >
              <X size={16} />
            </button>
          )}

          <button
            type="button"
            onClick={handleMicClick}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-800 text-zinc-400 transition-all active:scale-95"
            title="Ditar endereço"
          >
            <Mic size={16} />
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={handlePaste}
        className="flex h-10 items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 text-[10px] font-black text-zinc-400 transition-all active:scale-[0.98]"
      >
        <ClipboardPaste size={14} className="text-sky-400" />
        Colar endereço ou link do Google Maps
      </button>
    </div>
  );
}
