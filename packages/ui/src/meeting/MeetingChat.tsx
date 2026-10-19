import { InitialAvatar } from './InitialAvatar';
import { useRef } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import type { MeetingChatProps } from './types';
export function MeetingChat({
  messages,
  draft,
  onDraft,
  onSend,
  disabled,
  sending,
  maxLength,
  placeholder,
  sendLabel,
  emptyLabel,
  status,
  error,
  tools,
  compact,
  roomName,
  roomSubtitle,
  Button,
  Input,
  Icon,
}: MeetingChatProps) {
  const list = useRef<ScrollView>(null);
  return (
    <View style={styles.root}>
      {!compact && roomName && (
        <View style={styles.room}>
          <InitialAvatar name={roomName} />
          <View style={styles.flex}>
            <Text style={styles.roomName}>{roomName}</Text>
            <Text style={styles.sender}>{roomSubtitle}</Text>
          </View>
        </View>
      )}
      {status && (
        <Text accessibilityLiveRegion="polite" style={styles.status}>
          {status}
        </Text>
      )}
      <ScrollView
        ref={list}
        style={styles.flex}
        contentContainerStyle={[styles.messages, compact && { padding: 4, gap: 8 }]}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
      >
        {!messages.length && <Text style={styles.empty}>{emptyLabel}</Text>}
        {(compact ? messages.slice(-3) : messages).map((message) => (
          <View key={message.id} style={[styles.message, message.local && styles.local]}>
            {!compact && <InitialAvatar name={message.name} size={34} />}
            <View style={{ flexShrink: 1, gap: 6 }}>
              <Text style={styles.sender}>
                {message.name}
                {!compact && message.time ? `   ${message.time}` : ''}
              </Text>
              <View
                style={[
                  styles.bubble,
                  message.local && styles.localBubble,
                  compact && styles.compactBubble,
                ]}
              >
                {message.attachment || (
                  <Text selectable style={styles.text}>
                    {message.text}
                  </Text>
                )}
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
      {error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {!compact && tools}
      <View style={[styles.composer, compact && { padding: 0, paddingTop: 6 }]}>
        <View style={styles.flex}>
          <Input
            value={draft}
            onChangeText={onDraft}
            placeholder={placeholder}
            maxLength={maxLength}
            onSubmit={() => {
              if (!disabled && !sending && draft.trim()) onSend();
            }}
          />
        </View>
        <Button
          label={sendLabel}
          disabled={disabled || sending || !draft.trim()}
          appearance="icon"
          onPress={onSend}
        >
          <Icon name="send" size={20} color={disabled || sending ? '#66707A' : '#22CCEE'} />
        </Button>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  room: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 20,
    borderBottomWidth: 1,
    borderColor: '#2A3B46',
  },
  roomName: { color: '#E7EDF5', fontWeight: '600', marginBottom: 5 },
  compactBubble: { backgroundColor: 'transparent', borderWidth: 0, padding: 0 },
  root: { flex: 1, minHeight: 0 },
  flex: { flex: 1, minHeight: 0 },
  status: { color: '#96A5BB', padding: 12, fontSize: 12 },
  messages: { padding: 16, gap: 18 },
  message: {
    maxWidth: '94%',
    alignSelf: 'flex-start',
    gap: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  local: { alignSelf: 'flex-end', alignItems: 'flex-start', flexDirection: 'row-reverse' },
  sender: { color: '#96A5BB', fontSize: 11 },
  bubble: {
    backgroundColor: '#1D2E3A',
    borderRadius: 14,
    borderTopLeftRadius: 0,
    borderWidth: 1,
    borderColor: '#2C4352',
    padding: 12,
  },
  localBubble: { backgroundColor: '#153B46' },
  text: { color: '#E7EDF5', fontSize: 14, lineHeight: 21 },
  empty: { color: '#96A5BB', textAlign: 'center', marginTop: 24 },
  error: { color: '#FF8888', padding: 12, fontSize: 12 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#FFFFFF0D',
  },
});
