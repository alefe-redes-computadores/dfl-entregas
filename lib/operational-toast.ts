import { Capacitor } from '@capacitor/core';
import { Haptics, NotificationType } from '@capacitor/haptics';
import { toast as sonnerToast } from 'sonner';

type ToastData = Parameters<typeof sonnerToast.success>[1];
type ToastMessage = Parameters<typeof sonnerToast.success>[0];

const stableId = (kind: string, message: ToastMessage, data?: ToastData) =>
  data?.id ?? `dfl-toast:${kind}:${typeof message === 'string' ? message : 'content'}`;

const pulse = (type: NotificationType) => {
  if (!Capacitor.isNativePlatform()) return;
  void Haptics.notification({ type }).catch(() => undefined);
};

const feedback = (
  kind: string,
  type: NotificationType,
  method: typeof sonnerToast.success,
) => (message: ToastMessage, data?: ToastData) => {
  pulse(type);
  return method(message, { ...data, id: stableId(kind, message, data) });
};

const quiet = (
  kind: string,
  method: typeof sonnerToast.success,
) => (message: ToastMessage, data?: ToastData) =>
  method(message, { ...data, id: stableId(kind, message, data) });

export const toast = {
  success: feedback('success', NotificationType.Success, sonnerToast.success),
  error: feedback('error', NotificationType.Error, sonnerToast.error),
  warning: feedback('warning', NotificationType.Warning, sonnerToast.warning),
  info: quiet('info', sonnerToast.info),
  message: quiet('message', sonnerToast.message),
  loading: quiet('loading', sonnerToast.loading),
  dismiss: sonnerToast.dismiss,
};
