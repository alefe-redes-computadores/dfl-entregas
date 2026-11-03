'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ASSISTANT_SHORTCUTS_STORAGE_KEY,
  EMPTY_ASSISTANT_SHORTCUTS,
  parseAssistantShortcuts,
  rememberAssistantShortcut,
  serializeAssistantShortcuts,
  toggleAssistantFavorite,
  type AssistantShortcutId,
  type AssistantShortcutsState,
} from '@/lib/operation/assistant-shortcuts';

/** Preferências de dispositivo, sem dados de clientes nem tráfego remoto. */
export function useAssistantShortcuts() {
  const [shortcuts, setShortcuts] = useState<AssistantShortcutsState>(EMPTY_ASSISTANT_SHORTCUTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try { setShortcuts(parseAssistantShortcuts(window.localStorage.getItem(ASSISTANT_SHORTCUTS_STORAGE_KEY))); }
    catch { /* Navegador pode bloquear storage; estado em memória continua funcionando. */ }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try { window.localStorage.setItem(ASSISTANT_SHORTCUTS_STORAGE_KEY, serializeAssistantShortcuts(shortcuts)); }
    catch { /* O atalho não depende de permissão de armazenamento. */ }
  }, [shortcuts, loaded]);

  const change = useCallback((updater: (value: AssistantShortcutsState) => AssistantShortcutsState) => {
    setShortcuts(current => updater(current));
  }, []);

  const toggleFavorite = useCallback((id: AssistantShortcutId) => change(state => toggleAssistantFavorite(state, id)), [change]);
  const remember = useCallback((id: AssistantShortcutId) => change(state => rememberAssistantShortcut(state, id)), [change]);
  return { shortcuts, toggleFavorite, remember };
}
