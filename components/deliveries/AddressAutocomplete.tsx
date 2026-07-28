'use client';

import { useState, useRef, useEffect } from 'react';
import { MapPin, Mic, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelectAddress?: (fullAddress: string) => void;
  placeholder?: string;
  label?: string;
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelectAddress,
  placeholder = "Ex: Rua Major Gote, 100",
  label = "Endereço de Entrega*"
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);

  // Inicializa o serviço do Google Places com segurança
  const initService = () => {
    if (typeof window !== 'undefined' && window.google?.maps?.places) {
      if (!autocompleteService.current) {
        autocompleteService.current = new google.maps.places.AutocompleteService();
      }
      return true;
    }
    return false;
  };

  useEffect(() => {
    // Tenta carregar imediatamente e faz novas tentativas caso o script do layout demore a injetar
    if (!initService()) {
      const timer = setInterval(() => {
        if (initService()) {
          clearInterval(timer);
        }
      }, 500);
      return () => clearInterval(timer);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);

    // Se o serviço do Google ainda não estiver pronto, apenas atualiza o texto sem travar
    if (!val.trim() || !initService() || !autocompleteService.current) {
      setSuggestions([]);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    
    autocompleteService.current.getPlacePredictions(
      {
        input: val,
        componentRestrictions: { country: 'br' },
        location: new google.maps.LatLng(-18.5789, -46.5181),
        radius: 30000, 
      },
      (predictions, status) => {
        setIsLoading(false);
        if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
          setSuggestions(predictions);
          setIsOpen(true);
        } else {
          setSuggestions([]);
          setIsOpen(false);
        }
      }
    );
  };

  const handleSelectPrediction = (prediction: google.maps.places.AutocompletePrediction) => {
    onChange(prediction.description);
    setIsOpen(false);
    setSuggestions([]);
    if (onSelectAddress) {
      onSelectAddress(prediction.description);
    }
  };

  // Foca no input e avisa sobre o microfone nativo do teclado Samsung / Gboard
  const handleVoiceInput = () => {
    const inputElement = document.getElementById('address-input-field') as HTMLInputElement;
    if (inputElement) {
      inputElement.focus();
      toast.info("Toque no microfone na barra inferior do seu teclado para ditar!", {
        duration: 3000,
      });
    }
  };

  return (
    <div className="relative flex flex-col gap-2">
      <label className="text-sm font-semibold text-zinc-400 flex items-center justify-between">
        <span className="flex items-center gap-1.5"><MapPin size={14} className="text-indigo-400" /> {label}</span>
        <span className="text-[10px] text-zinc-500 font-normal">Toque no mic do teclado para ditar 🎙️</span>
      </label>

      <div className="relative flex items-center">
        <input 
          id="address-input-field"
          type="text" 
          value={value} 
          onChange={handleInputChange} 
          placeholder={placeholder} 
          className="h-14 w-full rounded-2xl border border-zinc-800 bg-zinc-900/50 pl-4 pr-12 text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none transition-all text-sm font-semibold" 
          required 
        />
        
        <button 
          type="button"
          onClick={handleVoiceInput}
          className="absolute right-3 p-2 text-zinc-400 hover:text-indigo-400 transition-colors cursor-pointer"
          title="Ativar Instrução de Voz"
        >
          {isLoading ? <Loader2 size={18} className="animate-spin text-indigo-400" /> : <Mic size={18} />}
        </button>
      </div>

      {/* Caixa de Sugestões Suspensas do Google Maps */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute top-20 z-50 w-full flex flex-col bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
          {suggestions.map((item) => (
            <button
              key={item.place_id}
              type="button"
              onClick={() => handleSelectPrediction(item)}
              className="flex items-start gap-3 p-3 text-left hover:bg-zinc-800 border-b border-zinc-800/50 last:border-0 transition-colors cursor-pointer"
            >
              <MapPin size={16} className="text-indigo-400 shrink-0 mt-1" />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-zinc-100">{item.structured_formatting.main_text}</span>
                <span className="text-[10px] text-zinc-400">{item.structured_formatting.secondary_text}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
