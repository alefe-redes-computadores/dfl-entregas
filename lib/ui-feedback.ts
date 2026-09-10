// lib/ui-feedback.ts
import { Haptics, NotificationType } from '@capacitor/haptics';

async function notify(type: NotificationType) {
  try {
    await Haptics.notification({ type });
  } catch {
    // PWA/browser sem implementação nativa: feedback visual continua funcionando.
  }
}

export const feedbackSuccess = () => notify(NotificationType.Success);
export const feedbackError = () => notify(NotificationType.Error);
export const feedbackWarning = () => notify(NotificationType.Warning);
