import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { meetingColors } from '../theme';
import type { MeetingSheetProps } from './types';
/** Kept mounted when closed so drafts and platform controls retain their owners. */
export function MeetingSheet({
  open,
  title,
  subtitle,
  onClose,
  onBack,
  content,
  Button,
  Icon,
  closeLabel,
  backLabel,
  height = '88%',
  hideHeader,
  variant,
}: MeetingSheetProps) {
  return (
    <View
      collapsable={false}
      pointerEvents={open ? 'auto' : 'none'}
      style={[s.overlay, !open && s.hidden]}
      accessibilityViewIsModal={open}
      accessibilityElementsHidden={!open}
      importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
    >
      <Pressable
        style={s.backdrop}
        accessible={false}
        focusable={false}
        importantForAccessibility="no"
        onPress={onClose}
      />
      <View collapsable={false} style={[s.sheet, { height }, variant === 'drawer' && s.drawer]}>
        <View style={s.grabber} />
        {!hideHeader && (
          <MeetingSheetHeader
            title={title}
            subtitle={subtitle}
            onClose={onClose}
            onBack={onBack}
            Button={Button}
            Icon={Icon}
            closeLabel={closeLabel}
            backLabel={backLabel}
          />
        )}

        <View collapsable={false} style={s.content}>
          {content}
        </View>
      </View>
    </View>
  );
}
export function MeetingSheetHeader({
  title,
  subtitle,
  onClose,
  onBack,
  Button,
  Icon,
  closeLabel,
  backLabel,
}: Pick<
  MeetingSheetProps,
  'title' | 'subtitle' | 'onClose' | 'onBack' | 'Button' | 'Icon' | 'closeLabel' | 'backLabel'
>) {
  return (
    <View style={s.header}>
      {onBack && (
        <Button appearance="icon" label={backLabel} onPress={onBack}>
          {Icon ? <Icon name="back" color="#9AAEBB" /> : backLabel}
        </Button>
      )}
      <View style={s.heading}>
        <Text style={s.title}>{title}</Text>
        {subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
      </View>
      <Button appearance="icon" label={closeLabel} onPress={onClose}>
        {Icon ? <Icon name="close" size={16} color="#9AAEBB" /> : closeLabel}
      </Button>
    </View>
  );
}
const s = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 30, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: '#02080DCF' },
  sheet: {
    backgroundColor: meetingColors.modal,
    borderColor: '#344650',
    borderWidth: 1,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: 'hidden',
    paddingBottom: 16,
  },
  drawer: { width: '88%', height: '100%', borderTopLeftRadius: 0 },
  grabber: {
    width: 32,
    height: 4,
    borderRadius: 3,
    backgroundColor: '#435661',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderColor: '#293740',
  },
  heading: { flex: 1, minWidth: 0, gap: 6 },
  title: { color: '#E8EFF3', fontSize: 18, fontWeight: '600' },
  subtitle: { color: '#829EAE', fontSize: 12, lineHeight: 18 },
  content: { flex: 1, minHeight: 0 },
  hidden: Platform.OS === 'web' ? { display: 'none' } : { opacity: 0, zIndex: -1 },
});
