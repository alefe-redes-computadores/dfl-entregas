// hooks/useNotifications.ts
import {
  notifyOperational,
  notifyRouteFinished,
  notifySyncFailure,
} from '@/lib/native/notifications';

export function useNotifications() {
  return {
    sendLocalNotification: (title: string, body: string, id?: number) =>
      notifyOperational(`legacy:${id ?? `${title}|${body}`}`, title, body),
    notifyRouteFinished: (routeName: string) =>
      notifyRouteFinished(`legacy:${routeName}`, routeName),
    notifySyncError: notifySyncFailure,
  };
}
