'use client';

import { ExternalLink, MapPin, Navigation, ShieldCheck } from 'lucide-react';
import { buildNavigationLinks } from '@/lib/navigation-links';
import { locationEvidence } from '@/lib/location-evidence';

type Props = { address: string; mapsLink?: string | null };

/** Preview only; never represents geocoding, persisted evidence or verified GPS. */
export function NavigationLinkAssistance({ address, mapsLink }: Props) {
  const explicit = Boolean((mapsLink || '').trim());
  const navigation = buildNavigationLinks(address, mapsLink);
  const evidence = locationEvidence(address, mapsLink);
  const precise = evidence.kind === 'coordinate';

  return (
    <div data-dfl-navigation-assistance className="rounded-2xl border border-sky-500/20 bg-sky-500/[.055] p-3.5">
      <div className="flex items-start gap-2.5">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sky-500/10 text-sky-300"><Navigation size={17} /></div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black text-sky-200">{explicit ? 'Link de localização informado' : navigation ? 'Rota gerada a partir do endereço' : 'Aguardando endereço para gerar rota'}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
            {explicit
              ? precise ? 'Coordenadas identificadas. Confira o destino no mapa antes de iniciar.' : 'O link informado será usado quando compatível. Confira o ponto no mapa.'
              : navigation
                ? 'Sem link manual: o DFL prepara a pesquisa de trajeto no Google Maps e no Waze. Isso não significa que o endereço foi geolocalizado ou validado.'
                : 'Informe rua, número e bairro. O DFL poderá preparar os atalhos de navegação automaticamente.'}
          </p>
        </div>
      </div>
      {navigation && (
        <div className="mt-3 flex flex-wrap gap-2">
          <a data-dfl-maps-preview href={navigation.maps} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-sky-400/25 bg-sky-400/10 px-3 text-[11px] font-black text-sky-200"><MapPin size={14} /> Conferir no Maps <ExternalLink size={12} /></a>
          <a data-dfl-waze-preview href={navigation.waze} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/75 px-3 text-[11px] font-black text-zinc-200"><Navigation size={14} /> Abrir Waze <ExternalLink size={12} /></a>
        </div>
      )}
      <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-relaxed text-zinc-500"><ShieldCheck size={12} className="mt-0.5 shrink-0" /> Prévia de navegação. Não altera o pedido nem salva automaticamente um link externo.</p>
    </div>
  );
}
