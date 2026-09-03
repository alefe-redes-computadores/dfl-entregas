'use client';

import { useMemo } from 'react';
import { resolveStopLocation } from '@/lib/maps';

interface MiniMapProps {
  address: string;
  mapsLink?: string;
}

export function MiniMap({ address, mapsLink }: MiniMapProps) {
  if (!address && !mapsLink) return null;

  const targetLocation = useMemo(() => {
    return resolveStopLocation({ address_string: address || '' }, mapsLink);
  }, [address, mapsLink]);

  const encodedTarget = encodeURIComponent(targetLocation);
  const embedUrl = `https://maps.google.com/maps?q=${encodedTarget}&t=&z=16&ie=UTF8&iwloc=&output=embed`;
  const directMapsUrl = mapsLink || `https://www.google.com/maps/search/?api=1&query=${encodedTarget}`;

  return (
    <div className="relative mt-2 h-28 w-full overflow-hidden rounded-2xl border border-zinc-800/90 bg-zinc-950 shadow-inner">
      <iframe
        title={`Mapa para ${targetLocation}`}
        src={embedUrl}
        width="100%"
        height="100%"
        style={{ 
          border: 0, 
          filter: 'invert(90%) hue-rotate(180deg) contrast(115%)' 
        }}
        allowFullScreen={false}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="pointer-events-none opacity-85 transition-opacity duration-300"
      />
      
      <a
        href={directMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-950/40 opacity-0 transition-opacity hover:opacity-100 active:opacity-100 backdrop-blur-[1px]"
      >
        <span className="rounded-xl bg-emerald-500 px-3.5 py-1.5 text-xs font-black text-zinc-950 shadow-xl active:scale-95 transition-transform">
          Abrir no Google Maps ↗
        </span>
      </a>
    </div>
  );
}
