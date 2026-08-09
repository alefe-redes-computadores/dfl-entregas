'use client';

import { useStoreAutomation } from '@/hooks/useStoreAutomation';

export function StoreAutomation() {
  // Esse componente é invisível, ele só existe para rodar a automação 
  // no lado do cliente (celular) sem quebrar o Server Component do Layout.
  useStoreAutomation();
  return null;
}
