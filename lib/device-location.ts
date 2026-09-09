import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import type { LatLngPoint } from '@/lib/maps';

export type LocationFailureCode = 'insecure' | 'unsupported' | 'denied' | 'timeout' | 'unavailable' | 'unknown';
export class LocationFailure extends Error { constructor(public code: LocationFailureCode, message: string) { super(message); this.name = 'LocationFailure'; } }

const browserPosition = () => new Promise<GeolocationPosition>((resolve, reject) => {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    reject(new LocationFailure('unsupported','Este navegador não oferece localização.'));
    return;
  }
  navigator.geolocation.getCurrentPosition(resolve, reject, {
    enableHighAccuracy: false,
    timeout: 20000,
    maximumAge: 300000,
  });
});

export async function requestDeviceLocation(): Promise<LatLngPoint> {
  if (typeof window !== 'undefined' && !window.isSecureContext && location.hostname !== 'localhost') {
    throw new LocationFailure('insecure','A localização exige que o aplicativo esteja aberto em HTTPS.');
  }
  let nativeError: unknown;
  if (Capacitor.isNativePlatform()) {
    try {
      let permission = (await Geolocation.checkPermissions()).location;
      if (permission !== 'granted') {
        permission = (await Geolocation.requestPermissions({ permissions: ['location'] })).location;
      }
      if (permission !== 'granted') throw new Error('Permissão de localização negada.');
      const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000, maximumAge: 15000 });
      return { lat: position.coords.latitude, lng: position.coords.longitude };
    } catch (error) { nativeError = error; }
  }

  try {
    const position = await browserPosition();
    return { lat: position.coords.latitude, lng: position.coords.longitude };
  } catch (browserError) {
    if(browserError instanceof LocationFailure)throw browserError;
    const code=browserError&&typeof browserError==='object'&&'code' in browserError?Number(browserError.code):0;
    if(code===1)throw new LocationFailure('denied','A permissão de localização está bloqueada para este aplicativo/site.');
    if(code===2)throw new LocationFailure('unavailable','O Android não conseguiu determinar a posição. Aguarde sinal ou use a localização salva da loja.');
    if(code===3)throw new LocationFailure('timeout','O GPS demorou demais para responder. Toque em tentar novamente.');
    throw new LocationFailure('unknown',nativeError instanceof Error?nativeError.message:'Não foi possível consultar a localização.');
  }
}
