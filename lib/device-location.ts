import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import type { LatLngPoint } from '@/lib/maps';
import { validOriginPoint } from '@/lib/store-origin';

export type LocationFailureCode = 'insecure' | 'unsupported' | 'denied' | 'timeout' | 'unavailable' | 'unknown';
export class LocationFailure extends Error {
  constructor(public code: LocationFailureCode, message: string) { super(message); this.name = 'LocationFailure'; }
}

const positionToPoint = (position: { coords: { latitude: number; longitude: number } }): LatLngPoint => {
  const point = validOriginPoint(position.coords.latitude, position.coords.longitude);
  if (!point) throw new LocationFailure('unavailable', 'O GPS devolveu uma posição inválida. Tente novamente ao ar livre.');
  return point;
};

const browserPosition = () => new Promise<GeolocationPosition>((resolve, reject) => {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    reject(new LocationFailure('unsupported', 'Este navegador não permite consultar localização.'));
    return;
  }
  // Somente após toque do usuário. O navegador deve decidir se mostra o prompt.
  navigator.geolocation.getCurrentPosition(resolve, reject, {
    enableHighAccuracy: true, timeout: 20000, maximumAge: 30000,
  });
});

function nativeFailure(error: unknown): LocationFailure {
  if (error instanceof LocationFailure) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (/denied|permission|permiss|negad|not granted|restricted/i.test(message)) {
    return new LocationFailure('denied', 'Localização bloqueada no Android. Confira as permissões do DFL Entregas.');
  }
  if (/timed? ?out|timeout/i.test(message)) {
    return new LocationFailure('timeout', 'O GPS demorou a responder. Verifique se a localização do aparelho está ligada.');
  }
  if (/not implemented|not available|plugin|unimplemented/i.test(message)) {
    return new LocationFailure('unsupported', 'O APK não disponibilizou o GPS nativo. Atualize o DFL Entregas.');
  }
  return new LocationFailure('unavailable', `Localização nativa indisponível. ${message}`);
}

export async function requestDeviceLocation(): Promise<LatLngPoint> {
  // Capacitor não deve cair silenciosamente no GPS do WebView em caso de erro
  // nativo: isso pode esconder a falta de permissões no Manifest do APK.
  if (Capacitor.isNativePlatform()) {
    try {
      const current = await Geolocation.checkPermissions();
      let permission = current.location;
      if (permission !== 'granted') {
        const requested = await Geolocation.requestPermissions({ permissions: ['location'] });
        permission = requested.location;
      }
      if (permission !== 'granted') {
        throw new LocationFailure('denied', 'Permissão não concedida. Autorize a localização nas configurações do Android.');
      }
      return positionToPoint(await Geolocation.getCurrentPosition({
        enableHighAccuracy: true, timeout: 20000, maximumAge: 0,
      }));
    } catch (error) {
      throw nativeFailure(error);
    }
  }
  if (typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost') {
    throw new LocationFailure('insecure', 'A localização do navegador exige uma página HTTPS.');
  }
  try {
    return positionToPoint(await browserPosition());
  } catch (error) {
    if (error instanceof LocationFailure) throw error;
    const code = error && typeof error === 'object' && 'code' in error ? Number(error.code) : 0;
    if (code === 1) throw new LocationFailure('denied', 'Localização bloqueada para este site. Verifique a permissão nas configurações do navegador.');
    if (code === 2) throw new LocationFailure('unavailable', 'Não foi possível determinar a posição. Ligue a localização do dispositivo e tente novamente.');
    if (code === 3) throw new LocationFailure('timeout', 'A consulta demorou demais. Toque em tentar novamente.');
    throw new LocationFailure('unknown', 'Não foi possível consultar a localização neste dispositivo.');
  }
}
