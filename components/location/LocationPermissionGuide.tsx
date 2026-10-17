'use client';
import { Capacitor } from '@capacitor/core';
import { AlertTriangle, MapPin } from 'lucide-react';
import type { LocationFailureCode } from '@/lib/device-location';

/** Não abre configurações por URI não suportada: orientação específica para APK/PWA. */
export function LocationPermissionGuide({ code, compact = false }: {
  code: LocationFailureCode | null;
  compact?: boolean;
}) {
  if (!code) return null;
  const native = Capacitor.isNativePlatform();
  const denied = code === 'denied' || code === 'unsupported';
  return (
    <div role="status" className={`rounded-2xl border border-amber-500/20 bg-amber-500/[.06] ${compact ? 'p-3' : 'p-4'}`}>
      <p className="flex items-center gap-2 text-xs font-black text-amber-300">
        {denied ? <AlertTriangle size={15} /> : <MapPin size={15} />}
        {denied ? 'Localização precisa de autorização' : 'Não foi possível consultar o GPS'}
      </p>
      <p className="mt-2 text-[11px] leading-relaxed text-zinc-300">
        {native
          ? 'Android: Configurações → Aplicativos → DFL Entregas → Permissões → Localização → Permitir durante o uso. Ative também a Localização precisa.'
          : 'No navegador ou PWA, abra as permissões deste site (ícone ao lado do endereço) e permita Localização. Se já estiver bloqueada, redefina a permissão do site.'}
      </p>
      {native && (
        <p className="mt-2 text-[10px] leading-relaxed text-zinc-400">
          Se Localização não aparecer nas permissões do aplicativo, instale o próximo APK atualizado; esta versão pode não declarar a permissão no Android.
        </p>
      )}
      <p className="mt-2 text-[10px] text-zinc-400">
        Alternativa: salve coordenadas exatas ou um link do Google Maps nas configurações da Loja.
      </p>
    </div>
  );
}
