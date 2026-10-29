import { useAnalyticsPage } from '../analytics/hooks/useAnalyticsPage';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Keyboard, Linking, ScrollView, StyleSheet, View } from 'react-native';
import Toast from '@ant-design/react-native/lib/toast';
import { LegalDocumentContent, legalLink, legalAnchor, type LegalDocumentId } from '@vocespace/ui';
import { LegalNavigationContext } from './hooks/useLegalNavigation';
import { ProfilePage } from '../account/ProfilePage';
import { useI18n } from '../i18n';
type Destination = { documentId: LegalDocumentId; anchor?: string };
/** Full-screen navigation keeps the originating form and RTC owner mounted. */
export function LegalPages({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<Destination[]>([]);
  const open = useCallback((documentId: LegalDocumentId, anchor?: string) => {
    Keyboard.dismiss();
    setStack((current) => [...current, { documentId, anchor }]);
  }, []);
  const back = useCallback(() => setStack((current) => current.slice(0, -1)), []);
  const current = stack[stack.length - 1];
  useAnalyticsPage(current?.documentId, !!current, 10);
  return (
    <LegalNavigationContext.Provider value={open}>
      <View style={{ flex: 1 }}>
        <View
          style={{ flex: 1 }}
          pointerEvents={current ? 'none' : 'auto'}
          accessibilityElementsHidden={!!current}
          importantForAccessibility={current ? 'no-hide-descendants' : 'auto'}
        >
          {children}
        </View>
        {current && (
          <View style={[StyleSheet.absoluteFill, { zIndex: 100, elevation: 40 }]}>
            <LegalPage
              key={`${stack.length}-${current.documentId}`}
              destination={current}
              onBack={back}
              onOpen={open}
            />
          </View>
        )}
      </View>
    </LegalNavigationContext.Provider>
  );
}
function LegalPage({
  destination,
  onBack,
  onOpen,
}: {
  destination: Destination;
  onBack: () => void;
  onOpen: (documentId: LegalDocumentId, anchor?: string) => void;
}) {
  const { t } = useI18n();
  const scroll = useRef<ScrollView>(null);
  const positions = useRef<Record<string, number>>({});
  const pendingAnchor = useRef(legalAnchor(destination.anchor || ''));
  const jump = (anchor: string) => {
    const id = legalAnchor(anchor);
    if (!id) scroll.current?.scrollTo({ y: 0, animated: true });
    else if (positions.current[id] !== undefined)
      scroll.current?.scrollTo({ y: positions.current[id], animated: true });
    else pendingAnchor.current = id;
  };
  return (
    <ProfilePage title={t(`legal.${destination.documentId}`)} onBack={onBack} scrollRef={scroll}>
      <LegalDocumentContent
        documentId={destination.documentId}
        onSectionLayout={(id, y) => {
          positions.current[id] = y + 24;
          if (pendingAnchor.current === id) {
            pendingAnchor.current = '';
            scroll.current?.scrollTo({ y: y + 24, animated: false });
          }
        }}
        onOpenLink={(href) => {
          const link = legalLink(href, destination.documentId);
          if (link) {
            if (link.documentId === destination.documentId) jump(link.anchor);
            else onOpen(link.documentId, link.anchor);
          } else if (/^(https:\/\/|mailto:)/i.test(href)) {
            void Linking.openURL(href).catch(() => Toast.fail(t('native_settings.open_failed')));
          }
        }}
      />
    </ProfilePage>
  );
}
