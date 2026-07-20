'use client';

interface MiniMapProps {
  address: string;
  mapsLink?: string;
}

export function MiniMap({ address, mapsLink }: MiniMapProps) {
  if (!address) return null;

  // Codifica o endereço para a busca do Google Maps Embed (funciona nativamente sem chave de API paga)
  const encodedAddress = encodeURIComponent(address);
  const embedUrl = `https://maps.google.com/maps?q=${encodedAddress}&t=&z=15&ie=UTF8&iwloc=&output=embed`;

  return (
    <div className="relative mt-3 h-28 w-full overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900 shadow-inner">
      {/* Iframe do mapa com filtro inteligente para modo escuro */}
      <iframe
        title={`Mapa para ${address}`}
        src={embedUrl}
        width="100%"
        height="100%"
        style={{ 
          border: 0, 
          filter: 'invert(90%) hue-rotate(180deg) contrast(110%)' 
        }}
        allowFullScreen={false}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="pointer-events-none opacity-85 transition-opacity duration-300"
      />
      
      {/* Camada de clique para abrir direto no app do Google Maps se houver link ou endereço */}
      <a
        href={mapsLink || `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-950/40 opacity-0 transition-opacity hover:opacity-100 active:opacity-100 backdrop-blur-[2px]"
      >
        <span className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-zinc-950 shadow-lg">
          Abrir no Maps ↗
        </span>
      </a>
    </div>
  );
}
