import { StyleSheet, Text, View } from 'react-native';
import { CONFERENCE_MESSAGE_LIMIT } from '@vocespace/contracts';
import { Input, PrimaryButton } from '../ui/controls';
import { colors, ui } from '../theme';
import type { useConferenceChat } from './useConferenceChat';

export function ConferenceChat({
  model,
  identity,
}: {
  model: ReturnType<typeof useConferenceChat>;
  identity: string;
}) {
  const { state } = model;
  const status = {
    idle: '正在准备聊天…',
    connecting: '正在连接聊天…',
    connected: '最近 50 条会议消息',
    offline: '聊天连接中断，正在尝试重连。',
    denied: '聊天权限已失效，请退出会议后重新加入。',
  }[state.connection];
  return (
    <View style={ui.card}>
      <Text style={ui.subtitle}>会议聊天</Text>
      <Text style={ui.body} accessibilityLiveRegion="polite">
        {status}
      </Text>
      {state.connection === 'offline' && (
        <PrimaryButton onPress={model.reconnect}>重新连接聊天</PrimaryButton>
      )}
      {state.loadingHistory && <Text style={ui.body}>正在同步消息…</Text>}
      {state.historyError && (
        <>
          <Text style={ui.body}>历史消息暂时加载失败，仍可收发新消息。</Text>
          <PrimaryButton
            onPress={() => {
              void model.refresh();
            }}
          >
            重新加载消息
          </PrimaryButton>
        </>
      )}
      {state.connection === 'connected' &&
        !state.loadingHistory &&
        !state.historyError &&
        !state.messages.length && <Text style={ui.body}>还没有消息，打个招呼吧。</Text>}
      {state.messages.map((item) => (
        <View key={`${item.sender.id}:${item.id}`} style={styles.message}>
          <Text style={styles.sender}>
            {item.sender.name}
            {item.sender.id === identity ? '（我）' : ''}
          </Text>
          <Text selectable style={ui.body}>
            {item.type === 'file' ? '［文件消息，请在网页端查看］' : item.message}
          </Text>
        </View>
      ))}
      <Input
        accessibilityLabel="会议消息"
        placeholder="发送会议消息"
        value={state.draft}
        onChangeText={model.setDraft}
        multiline
        maxLength={CONFERENCE_MESSAGE_LIMIT}
        editable={state.connection !== 'denied'}
        style={styles.input}
      />
      {state.sendError && (
        <Text accessibilityRole="alert" style={ui.body}>
          发送尚未确认，内容已保留，请重试。
        </Text>
      )}
      <PrimaryButton
        disabled={state.connection !== 'connected' || state.sending || !state.draft.trim()}
        onPress={() => {
          void model.send();
        }}
      >
        {state.sending ? '正在发送…' : state.sendError ? '重试发送' : '发送'}
      </PrimaryButton>
    </View>
  );
}
const styles = StyleSheet.create({
  message: {
    paddingVertical: 8,
    gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sender: { color: colors.accent, fontSize: 13 },
  input: { minHeight: 80, maxHeight: 160 },
});
