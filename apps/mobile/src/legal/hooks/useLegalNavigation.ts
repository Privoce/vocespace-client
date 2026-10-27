import { createContext, useContext } from 'react';
import type { LegalDocumentId } from '@vocespace/ui';
export const LegalNavigationContext = createContext<
  (documentId: LegalDocumentId, anchor?: string) => void
>(() => {});
export function useLegalNavigation() {
  return useContext(LegalNavigationContext);
}
