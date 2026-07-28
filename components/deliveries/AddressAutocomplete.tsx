'use client';

import { useState, useRef, useEffect } from 'react';
import { MapPin, Mic, Loader2, MicOff } from 'lucide-react';
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
  const [isListening, setIsListening] = useState(false);
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
    
    // Dispara a busca no Google Maps
    autocompleteService.current.getPlacePredictions(
      {
        input: val,
        componentRestrictions: { country: 'br' },
        location: new google.maps.LatLng(-18.5789, -46.5181), // Coordenadas de Patos de Minas
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
          
          // 🔥 ALARME NA TELA: Mostra o erro exato do Google se não for apenas "sem resultados"
          if (status !== google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
             toast.error(`Bloqueio do Google Maps: ${status}`);
          }
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

  // 🎙️ DISPARADOR REAL DE DITADO POR VOZ (WEB SPEECH API / ANDROID CHROME)
  const handleVoiceInput = () => {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      toast.error("O reconhecimento de voz não é suportado neste navegador.");
      return;
    }

    try {
      const recognition = new SpeechRecognitionAPI();
      recognition.lang = 'pt-BR';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        toast.message("Ouvindo... Pode falar o endereço! 🎙️");
      };

      recognition.onresult = (event: any) => {
        const speechText = event.results[0][0].transcript;
        onChange(speechText);
        setIsListening(false);
        toast.success("Endereço capturado por voz! ✨");
      };

      recognition.onerror = (event: any) => {
        console.error("Erro no reconhecimento de voz:", event.error);
        setIsListening(false);
        toast.error("Não foi possível capturar a voz. Tente novamente.");
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (error) {
      console.error("Erro ao iniciar o microfone:", error);
      setIsListening(false);
      toast.error("Erro ao ativar o microfone.");
    }
  };

  return (
    <div className="relative flex flex-col gap-2">
      <label className="text-sm font-semibold text-zinc-400 flex items-center justify-between">
        <span className="flex items-center gap-1.5"><MapPin size={14} className="text-indigo-400" /> {label}</span>
        <span className="text-[10px] text-zinc-500 font-normal">Toque no mic para ditar por voz 🎙️</span>
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
          className={`absolute right-3 p-2 transition-colors cursor-pointer rounded-xl ${
            isListening ? 'bg-red-500/20 text-red-400 animate-pulse' : 'text-zinc-400 hover:text-indigo-400'
          }`}
          title="Falar Endereço"
        >
          {isListening ? <MicOff size={18} className="text-red-500" /> : isLoading ? <Loader2 size={18} className="animate-spin text-indigo-400" /> : <Mic size={18} />}
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
