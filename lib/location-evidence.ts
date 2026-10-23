import { extractLatLngFromMapsUrl } from '@/lib/maps';

export type EvidenceKind = 'coordinate' | 'link' | 'numbered' | 'approximate' | 'missing';
export type LocationEvidence = { kind: EvidenceKind; title: string; explanation: string; mapsUrl: string | null };

export function locationEvidence(address: string, mapsLink?: string | null): LocationEvidence {
  const clean = String(address || '').trim();
  const link = String(mapsLink || '').trim();
  const point = extractLatLngFromMapsUrl(link);
  const validLink = /^https:\/\//i.test(link) || /^http:\/\//i.test(link);
  const hasNumber = /(?:^|[,\s])\d{1,5}[a-z]?(?:\s|,|$)/i.test(clean);
  const mapsUrl = validLink ? link : clean ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clean+', Patos de Minas - MG')}` : null;
  if (point) return {kind:'coordinate',title:'Ponto com coordenadas', explanation:'O link contém latitude e longitude. Confira se o pin coincide com a entrada do imóvel; não é garantia de 100% de acerto.',mapsUrl};
  if (validLink) return {kind:'link',title:'Link do mapa disponível',explanation:'O link foi salvo, mas não possui coordenadas verificáveis localmente. Confira o destino no Maps.',mapsUrl};
  if (clean && hasNumber) return {kind:'numbered',title:'Endereço com número',explanation:'Prévia por busca textual. O Google Maps pode posicionar aproximadamente na via.',mapsUrl};
  if (clean) return {kind:'approximate',title:'Localização aproximada',explanation:'Complete rua, número e bairro ou cole um link com coordenadas.',mapsUrl};
  return {kind:'missing',title:'Destino não informado',explanation:'Informe o endereço antes de abrir a prévia.',mapsUrl:null};
}
