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
  Button,
  Input,
  Icon,
}: MeetingChatProps) {
  const list = useRef<ScrollView>(null);
  return (
    <View style={styles.root}>
      {status && (
        <Text accessibilityLiveRegion="polite" style={styles.status}>
          {status}
        </Text>
      )}
      <ScrollView
        ref={list}
        style={styles.flex}
        contentContainerStyle={styles.messages}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
      >
        {!messages.length && <Text style={styles.empty}>{emptyLabel}</Text>}
        {messages.map((message) => (
          <View key={message.id} style={[styles.message, message.local && styles.local]}>
            <Text style={styles.sender}>{message.name}</Text>
            <View style={[styles.bubble, message.local && styles.localBubble]}>
              {message.attachment || (
                <Text selectable style={styles.text}>
                  {message.text}
                </Text>
              )}
            </View>
          </View>
        ))}
      </ScrollView>
      {error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {tools}
      <View style={styles.composer}>
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
          active
          onPress={onSend}
        >
          <Icon name="send" size={20} color={disabled || sending ? '#66707A' : '#0B1015'} />
        </Button>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  flex: { flex: 1, minHeight: 0 },
  status: { color: '#96A5BB', padding: 12, fontSize: 12 },
  messages: { padding: 16, gap: 18 },
  message: { maxWidth: '88%', alignSelf: 'flex-start', gap: 6 },
  local: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  sender: { color: '#96A5BB', fontSize: 11 },
  bubble: { backgroundColor: '#202832', borderRadius: 12, padding: 12 },
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
