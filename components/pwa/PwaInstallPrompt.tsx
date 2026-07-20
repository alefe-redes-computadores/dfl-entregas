'use client';

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    // 1. Registra o Service Worker automaticamente ao abrir o app
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('Erro ao registrar Service Worker:', err);
      });
    }

    // 2. Ouve o evento do navegador que avisa que o app pode ser instalado
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowButton(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      toast.success('Aplicativo instalado com sucesso!');
    }
    setDeferredPrompt(null);
    setShowButton(false);
  };

  if (!showButton) return null;

  return (
    <button
      onClick={handleInstallClick}
      className="flex items-center gap-2 rounded-xl bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-400 border border-emerald-500/30 active:scale-95 transition-transform"
    >
      <Download size={14} />
      Instalar App
    </button>
  );
}
