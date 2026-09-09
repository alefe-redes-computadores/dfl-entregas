import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import type { LatLngPoint } from '@/lib/maps';

const browserPosition = () => new Promise<GeolocationPosition>((resolve, reject) => {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    reject(new Error('Este navegador não oferece localização.'));
    return;
  }
  navigator.geolocation.getCurrentPosition(resolve, reject, {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 15000,
  });
});

export async function requestDeviceLocation(): Promise<LatLngPoint> {
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
    const error = browserError && typeof browserError === 'object' && 'message' in browserError
      ? String(browserError.message)
      : browserError instanceof Error ? browserError.message : '';
    throw new Error(error || (nativeError instanceof Error ? nativeError.message : 'Localização indisponível.'));
  }
}
