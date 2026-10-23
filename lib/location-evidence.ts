import { extractLatLngFromMapsUrl } from '@/lib/maps';

export type EvidenceKind = 'coordinate' | 'link' | 'numbered' | 'approximate' | 'missing';
export type LocationEvidence = { kind: EvidenceKind; title: string; explanation: string; mapsUrl: string | null };

export function locationEvidence(address: string, mapsLink?: string | null): LocationEvidence {
  const clean = String(address || '').trim();
  const link = String(mapsLink || '').trim();
  // Only recognized map URLs can be used as source evidence. An arbitrary
  // HTTPS link containing @lat,lng is NOT a verified navigation reference.
  const validLink = /^https:\/\/(?:maps\.app\.goo\.gl\/|(?:www\.|maps\.)?google\.(?:com(?:\.br)?|co\.[a-z]{2}|[a-z]{2})\/maps(?:[/?#]|$)|(?:www\.)?waze\.com\/ul(?:[?#]|$))/i.test(link);
  const point = validLink ? extractLatLngFromMapsUrl(link) : null;
  const hasNumber = /(?:^|[,\s])\d{1,5}[a-z]?(?:\s|,|$)/i.test(clean);
  const mapsSearch = /patos de minas/i.test(clean) ? clean : `${clean}, Patos de Minas - MG`;
  const mapsUrl = validLink ? link : clean ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsSearch)}` : null;
  if (point) return {kind:'coordinate',title:'Ponto com coordenadas', explanation:'O link contém latitude e longitude. Confira se o pin coincide com a entrada do imóvel; não é garantia de 100% de acerto.',mapsUrl};
  if (validLink) return {kind:'link',title:'Link do mapa disponível',explanation:'O link foi salvo, mas não possui coordenadas verificáveis localmente. Confira o destino no Maps.',mapsUrl};
  if (clean && hasNumber) return {kind:'numbered',title:'Endereço com número',explanation:'Prévia por busca textual. O Google Maps pode posicionar aproximadamente na via.',mapsUrl};
  if (clean) return {kind:'approximate',title:'Localização aproximada',explanation:'Complete rua, número e bairro ou cole um link com coordenadas.',mapsUrl};
  return {kind:'missing',title:'Destino não informado',explanation:'Informe o endereço antes de abrir a prévia.',mapsUrl:null};
}
