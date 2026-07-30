'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

export default function ClientInit() {
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      try {
        // Deixa o app em tela cheia sobrepondo a barra de status com elegância
        StatusBar.setOverlaysWebView({ overlay: true });
        StatusBar.setStyle({ style: Style.Dark });
      } catch (e) {
        console.error('Erro ao configurar StatusBar nativa:', e);
      }
    }
  }, []);

  return null;
}
