'use client';
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
export type ApkDownloadProgress = { build: number; received: number; total: number; percent: number };
export type ApkInstallAttempt = { opened?: boolean; permissionRequired?: boolean };
export interface DflApkUpdater {
  downloadVerified(options: { build: number; sha256: string; bytes: number }): Promise<{ verified: boolean; build: number }>;
  cancelDownload(): Promise<{ requested: boolean }>;
  installVerified(options: { build: number; sha256: string }): Promise<ApkInstallAttempt>;
  openInstallSettings(): Promise<void>;
  openReleasePage(options: { build: number }): Promise<{ opened: boolean }>;
  addListener(name: 'downloadProgress', callback: (event: ApkDownloadProgress) => void): Promise<PluginListenerHandle>;
}
const bridge = registerPlugin<DflApkUpdater>('DflApkUpdater');
export const getDflApkUpdater = (): DflApkUpdater | null =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('DflApkUpdater') ? bridge : null;
