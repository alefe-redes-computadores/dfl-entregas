import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address')?.trim();
  if (!address || address.length < 5 || address.length > 300) {
    return NextResponse.json({ error: 'Endereço inválido.' }, { status: 400 });
  }
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return NextResponse.json({ error: 'Chave de mapas não configurada.' }, { status: 503 });
  const query = /patos de minas/i.test(address) ? address : `${address}, Patos de Minas - MG, Brasil`;
  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', query); url.searchParams.set('region', 'br'); url.searchParams.set('key', key);
    const response = await fetch(url, { cache: 'no-store' });
    const data = await response.json();
    const location = data?.results?.[0]?.geometry?.location;
    if (!response.ok || !location || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) {
      return NextResponse.json({ error: data?.error_message || 'Endereço da loja não localizado.' }, { status: 422 });
    }
    return NextResponse.json({ lat: location.lat, lng: location.lng, formattedAddress: data.results[0].formatted_address });
  } catch {
    return NextResponse.json({ error: 'Falha ao consultar o endereço da loja.' }, { status: 502 });
  }
}
