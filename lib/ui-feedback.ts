// lib/ui-feedback.ts
import { Haptics, NotificationType } from '@capacitor/haptics';

function notify(type: NotificationType) {
  // Efeito opcional: nunca segurar salvar, excluir ou abrir confirmacoes.
  try {
    void Haptics.notification({ type }).catch(() => undefined);
  } catch { /* plugin indisponivel nao interrompe o fluxo */ }
}

export const feedbackSuccess = () => notify(NotificationType.Success);
export const feedbackError = () => notify(NotificationType.Error);
export const feedbackWarning = () => notify(NotificationType.Warning);
