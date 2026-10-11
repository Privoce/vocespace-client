import { View } from 'react-native';
import { MeetingChat } from '@vocespace/ui';
import { CONFERENCE_MESSAGE_LIMIT } from '@vocespace/contracts';
import { MeetingButton, MeetingIcon, MeetingInput } from '../ui/meeting';
import type { useConferenceChat } from './useConferenceChat';
export function SharedConferenceChat({
  model,
  identity,
}: {
  model: ReturnType<typeof useConferenceChat>;
  identity: string;
}) {
  const { state } = model;
  return (
    <MeetingChat
      Button={MeetingButton}
      Icon={MeetingIcon}
      Input={MeetingInput}
      messages={state.messages.map((item) => ({
        id: `${item.sender.id}:${item.id}`,
        name: item.sender.name,
        text: item.type === 'file' ? '［文件消息，请在网页端查看］' : item.message || '',
        local: item.sender.id === identity,
      }))}
      draft={state.draft}
      onDraft={model.setDraft}
      onSend={() => {
        void model.send();
      }}
      disabled={state.connection !== 'connected'}
      sending={state.sending}
      maxLength={CONFERENCE_MESSAGE_LIMIT}
      placeholder="发送会议消息"
      sendLabel={state.sending ? '正在发送' : '发送'}
      emptyLabel="还没有消息，打个招呼吧。"
      status={
        {
          idle: '正在准备聊天…',
          connecting: '正在连接聊天…',
          connected: state.loadingHistory ? '正在同步消息…' : '会议消息',
          offline: '聊天连接中断，正在尝试重连。',
          denied: '聊天权限已失效，请退出会议后重新加入。',
        }[state.connection]
      }
      error={
        state.sendError
          ? '发送尚未确认，草稿已保留，请重试。'
          : state.historyError
            ? '历史消息暂时加载失败，仍可收发新消息。'
            : undefined
      }
      tools={
        <View style={{ paddingHorizontal: 12, gap: 8 }}>
          {state.connection === 'offline' && (
            <MeetingButton onPress={model.reconnect}>重新连接聊天</MeetingButton>
          )}
          {state.historyError && (
            <MeetingButton
              onPress={() => {
                void model.refresh();
              }}
            >
              重新加载消息
            </MeetingButton>
          )}
        </View>
      }
    />
  );
}
