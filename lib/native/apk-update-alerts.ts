'use client';
/** Descoberta em foreground, somente se usuário autorizou avisos de atualizações. */
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { checkCertifiedAndroidApk } from './apk-release-service';
import { isNewCertifiedApk, parseInstalledApkBuild } from './apk-release-policy';
import { notificationPolicyAllows } from '@/lib/native/notification-delivery-policy';
import { useAppStore } from '@/store/useAppStore';

const OPTIN = 'dfl-p360-apk-alert-optin';
const LAST = 'dfl-p360-apk-alert-last';
const CHANNEL = 'dfl-entregas-updates-p360';
let checking = false;
let lastCheck = 0;
const native = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
const read = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key: string, value: string) => { try { localStorage.setItem(key, value); return true; } catch { return false; } };
export const apkAlertsEnabled = () => native() && read(OPTIN) === '1';
const notificationId = (build: number) => 1_812_000_000 + build % 100_000;

export async function setApkAlertsEnabled(enabled: boolean): Promise<boolean> {
  if (!native()) return false;
  if (!enabled) {
    write(OPTIN, '0');
    const last = Number(read(LAST) || 0);
    if (last > 0) await LocalNotifications.cancel({ notifications: [{ id: notificationId(last) }] }).catch(() => undefined);
    return false;
  }
  try {
    const permission = await LocalNotifications.requestPermissions();
    if (permission.display !== 'granted') { write(OPTIN, '0'); return false; }
    return write(OPTIN, '1');
  } catch { return false; }
}

export async function checkAndNotifyApkUpdate(force = false): Promise<void> {
  if (!native() || !apkAlertsEnabled() || checking) return;
  if (!force && Date.now() - lastCheck < 20 * 60_000) return;
  checking = true;
  lastCheck = Date.now();
  try {
    const info = await App.getInfo();
    if (info.id !== 'com.dfl.entregas') return;
    const build = parseInstalledApkBuild(info.build);
    const { apk } = await checkCertifiedAndroidApk(force);
    if (!isNewCertifiedApk(build, apk) || !apk || read(LAST) === String(apk.build)) return;
    // Respeitar o interruptor geral, prioridade e horário de silêncio da P2.
    // Evita usar preferências provisórias antes da hidratação da operação.
    if (!useAppStore.getState().hasHydrated) return;
    const prefs = useAppStore.getState().storeSettings.notificationPreferences;
    if (prefs?.enabled === false || !notificationPolicyAllows('systemUpdate', new Date(), prefs?.deliveryPolicy)) return;
    const permission = await LocalNotifications.checkPermissions();
    if (permission.display !== 'granted' || !apkAlertsEnabled()) return;
    await LocalNotifications.createChannel({ id: CHANNEL, name: 'Atualizações DFL Entregas', description: 'Nova versão Android certificada', importance: 3 });
    if (!apkAlertsEnabled()) return;
    await LocalNotifications.schedule({ notifications: [{ id: notificationId(apk.build), title: 'Atualização do DFL Entregas', body: `APK #${apk.build} certificado disponível. Toque para atualizar.`, channelId: CHANNEL, smallIcon: 'ic_stat_dfl', schedule: { at: new Date(Date.now() + 2300) }, extra: { href: '/mais/atualizacoes', dflOwner: 'apk-updates-p360' } }] });
    if (!apkAlertsEnabled()) { await LocalNotifications.cancel({ notifications: [{ id: notificationId(apk.build) }] }).catch(() => undefined); return; }
    write(LAST, String(apk.build));
  } catch { /* Não bloquear a operação e nunca anunciar status incerto. */ }
  finally { checking = false; }
}
