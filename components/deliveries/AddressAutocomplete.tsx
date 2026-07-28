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
  const [isGoogleReady, setIsGoogleReady] = useState(false);
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);

  // 🔥 INJEÇÃO DINÂMICA: O próprio componente carrega o Google Maps
  useEffect(() => {
    const loadGoogleMapsScript = () => {
      if (typeof window === 'undefined') return;

      if (window.google?.maps?.places) {
        if (!autocompleteService.current) {
          autocompleteService.current = new window.google.maps.places.AutocompleteService();
        }
        setIsGoogleReady(true);
        return;
      }

      const existingScript = document.getElementById('google-maps-script');
      if (existingScript) {
        existingScript.addEventListener('load', () => {
          autocompleteService.current = new window.google.maps.places.AutocompleteService();
          setIsGoogleReady(true);
        });
        return;
      }

      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        toast.error("Chave da API do Google não encontrada no .env");
        return;
      }

      const script = document.createElement('script');
      script.id = 'google-maps-script';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        autocompleteService.current = new window.google.maps.places.AutocompleteService();
        setIsGoogleReady(true);
      };
      
      script.onerror = () => {
        toast.error("Ocorreu um erro ao carregar o script do Google Maps no dispositivo.");
      };

      document.head.appendChild(script);
    };

    loadGoogleMapsScript();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);

    if (!val.trim() || !isGoogleReady || !autocompleteService.current) {
      setSuggestions([]);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const timeoutId = setTimeout(() => {
      setIsLoading((prev) => {
        if (prev) {
          toast.error("O Google Maps demorou demais para responder. Verifique sua internet ou bloqueios.");
          return false;
        }
        return prev;
      });
    }, 4000);

    try {
      autocompleteService.current.getPlacePredictions(
        {
          input: val,
          componentRestrictions: { country: 'br' },
          location: new google.maps.LatLng(-18.5789, -46.5181),
          radius: 30000, 
        },
        (predictions, status) => {
          clearTimeout(timeoutId);
          setIsLoading(false);

          if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
            setSuggestions(predictions);
            setIsOpen(true);
          } else {
            setSuggestions([]);
            setIsOpen(false);
            if (status !== google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
               toast.error(`Bloqueio do Google Maps: ${status}`);
            }
          }
        }
      );
    } catch (error) {
      clearTimeout(timeoutId);
      setIsLoading(false);
      toast.error("Erro interno ao tentar contatar o Google Maps.");
    }
  };

  const handleSelectPrediction = (prediction: google.maps.places.AutocompletePrediction) => {
    onChange(prediction.description);
    setIsOpen(false);
    setSuggestions([]);
    if (onSelectAddress) {
      onSelectAddress(prediction.description);
    }
  };

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
