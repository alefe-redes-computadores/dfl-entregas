// components/deliveries/AddressAutocomplete.tsx
'use client';

import {
  ClipboardPaste,
  Loader2,
  MapPin,
  Mic,
  Navigation,
  Search,
  X,
} from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';

import {
  cancelAddressAutocompleteSession,
  fetchAddressSuggestions,
  resolveAddressSuggestion,
  type AddressSuggestion,
} from '@/lib/address-autocomplete';

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
  placeholder = 'Ex: Major Gote, 123',
  label = 'Rua e Número*',
  onMapsLinkDetected,
  localityHint = 'Busca priorizada em Patos de Minas · MG',
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [searchUnavailable, setSearchUnavailable] = useState(false);

  const requestId = useRef(0);
  const selectedValue = useRef('');

  const hasAddress = value.trim().length > 0;
  const hasNumber = /\d+[A-Za-z]?\b/.test(value);

  useEffect(() => {
    const query = value.trim();

    if (
      !isFocused ||
      query.length < 3 ||
      query === selectedValue.current
    ) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    const currentRequest = ++requestId.current;

    const timer = window.setTimeout(async () => {
      setIsSearching(true);

      try {
        const next = await fetchAddressSuggestions(query);

        if (currentRequest !== requestId.current) return;

        setSuggestions(next);
        setSearchUnavailable(false);
      } catch (error) {
        if (currentRequest !== requestId.current) return;

        console.error('Autocomplete de endereço indisponível:', error);
        setSuggestions([]);
        setSearchUnavailable(true);
      } finally {
        if (currentRequest === requestId.current) {
          setIsSearching(false);
        }
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [isFocused, value]);

  useEffect(
    () => () => cancelAddressAutocompleteSession(),
    [],
  );

  const handleMicClick = () => {
    toast.info('Use o ditado do teclado', {
      description:
        'Toque no campo e use o microfone do teclado do celular.',
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

        const withoutLink = normalizeInput(
          text.replace(mapsMatch[0], ''),
        );

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

  const selectSuggestion = async (
    suggestion: AddressSuggestion,
  ) => {
    setIsResolving(true);

    try {
      const resolved =
        await resolveAddressSuggestion(suggestion);

      const nextAddress =
        resolved.address || resolved.formattedAddress;

      selectedValue.current = nextAddress;
      onChange(nextAddress);

      if (resolved.mapsLink && onMapsLinkDetected) {
        onMapsLinkDetected(resolved.mapsLink);
      }

      setSuggestions([]);
      setIsFocused(false);

      const extras = [
        resolved.neighborhood,
        resolved.postalCode
          ? `CEP ${resolved.postalCode}`
          : undefined,
      ].filter(Boolean);

      toast.success('Endereço localizado', {
        description: extras.length
          ? extras.join(' · ')
          : 'Localização vinculada à entrega.',
      });
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível usar esta sugestão.',
      );
    } finally {
      setIsResolving(false);
    }
  };

  const clear = () => {
    selectedValue.current = '';
    setSuggestions([]);
    cancelAddressAutocompleteSession();
    onChange('');
  };

  return (
    <div className="relative flex w-full flex-col gap-2">
      <div className="flex items-end justify-between gap-3">
        <div>
          {label && (
            <label className="text-sm font-semibold text-zinc-400">
              {label}
            </label>
          )}
          <p className="mt-0.5 text-[10px] font-medium text-zinc-600">
            {localityHint}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handlePaste}
            className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 active:bg-zinc-800"
            aria-label="Colar endereço"
          >
            <ClipboardPaste size={15} />
          </button>

          <button
            type="button"
            onClick={handleMicClick}
            className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 active:bg-zinc-800"
            aria-label="Ditado"
          >
            <Mic size={15} />
          </button>
        </div>
      </div>

      <div className="relative">
        <MapPin
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600"
        />

        <input
          value={value}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            window.setTimeout(() => setIsFocused(false), 180);
          }}
          onChange={(event) => {
            selectedValue.current = '';
            onChange(event.target.value);
          }}
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          className="h-13 w-full rounded-xl border border-zinc-800 bg-zinc-900/50 py-3 pl-10 pr-20 text-sm text-zinc-100 outline-none placeholder:text-zinc-700 focus:border-emerald-500"
        />

        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {(isSearching || isResolving) && (
            <Loader2
              size={15}
              className="animate-spin text-emerald-400"
            />
          )}

          {hasAddress && !isResolving && (
            <button
              type="button"
              onClick={clear}
              className="grid h-8 w-8 place-items-center rounded-lg text-zinc-600 active:bg-zinc-800"
              aria-label="Limpar endereço"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {isFocused && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/50">
          <div className="flex items-center gap-2 border-b border-zinc-900 px-3 py-2 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-600">
            <Search size={11} />
            Sugestões em Patos de Minas
          </div>

          <div className="max-h-72 overflow-y-auto p-1.5">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectSuggestion(suggestion)}
                disabled={isResolving}
                className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left active:bg-zinc-900 disabled:opacity-50"
              >
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400">
                  <Navigation size={14} />
                </span>
                <span className="min-w-0 flex-1 text-xs font-semibold leading-relaxed text-zinc-300">
                  {suggestion.label}
                </span>
              </button>
            ))}
          </div>

          <div className="border-t border-zinc-900 px-3 py-2 text-center text-[9px] text-zinc-700">
            Geoapify · seleção gera localização da entrega
          </div>
        </div>
      )}

      {searchUnavailable && isFocused && value.trim().length >= 3 && (
        <p className="px-1 text-[10px] text-amber-500/80">
          Sugestões online indisponíveis. Você ainda pode digitar o endereço manualmente.
        </p>
      )}

      {hasAddress && !hasNumber && (
        <p className="flex items-center gap-1.5 px-1 text-[10px] font-medium text-amber-400/80">
          <MapPin size={11} />
          Confira o número antes de salvar.
        </p>
      )}
    </div>
  );
}
