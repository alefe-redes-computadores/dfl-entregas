'use client';
/** Feedback sutil somente em eventos do usuário; evita vibração na carga da tela. */
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
export function staffTouch(): void {
  if (!Capacitor.isNativePlatform()) return;
  void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
}
