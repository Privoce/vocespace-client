import { SafeAreaView } from 'react-native-safe-area-context';
import { IconOutline } from '@ant-design/icons-react-native';
import { useI18n } from '../i18n';
import { View, Text, Modal, ScrollView } from 'react-native';
import { MeetingChat } from '@vocespace/ui';
import { CONFERENCE_MESSAGE_LIMIT } from '@vocespace/contracts';
import { MeetingButton, MeetingIcon, MeetingInput } from '../ui/meeting';
import type { useConferenceChat } from './hooks/useConferenceChat';
export function SharedConferenceChat({
  model,
  identity,
  compact,
  roomName,
}: {
  model: ReturnType<typeof useConferenceChat>;
  identity: string;
  compact?: boolean;
  roomName?: string;
}) {
  const { state } = model;
  const { t } = useI18n();
  return (
    <>
      <MeetingChat
        compact={compact}
        roomName={roomName}
        roomSubtitle={t('phone_meeting.chat_hint')}
        Button={MeetingButton}
        Icon={MeetingIcon}
        Input={MeetingInput}
        messages={state.messages.map((item) => ({
          id: `${item.sender.id}:${item.id}`,
          name: item.sender.name,
          time: new Date(item.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          text: item.message || '',
          attachment:
            item.type === 'file' ? (
              <MeetingButton onPress={() => void model.files.list()}>
                {t('shared_meeting.files')}
              </MeetingButton>
            ) : undefined,
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
        placeholder={t('phone_meeting.chat_placeholder')}
        sendLabel={state.sending ? '正在发送' : '发送'}
        emptyLabel="还没有消息，打个招呼吧。"
        status={
          {
            idle: '正在准备聊天…',
            connecting: '正在连接聊天…',
            connected: state.loadingHistory ? '正在同步消息…' : undefined,
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
        composerTools={
          <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 0, gap: 2 }}>
            <MeetingButton
              label={t('shared_meeting.upload')}
              appearance="icon"
              disabled={model.files.busy || state.connection !== 'connected'}
              onPress={() => void model.files.upload()}
            >
              <IconOutline name="plus" size={24} color="#eee" />
            </MeetingButton>
            <MeetingButton
              label={t('shared_meeting.files')}
              appearance="icon"
              disabled={model.files.busy}
              onPress={() => void model.files.list()}
            >
              <MeetingIcon name="file" size={22} />
            </MeetingButton>
          </View>
        }
        tools={
          <View style={{ paddingHorizontal: 12, gap: 8 }}>
            {model.files.error && (
              <Text accessibilityRole="alert" style={{ color: '#FF8888' }}>
                {t('shared_meeting.files_error')}
              </Text>
            )}
            {model.files.pending && (
              <MeetingButton disabled={model.files.busy} onPress={() => void model.files.upload()}>
                {t('shared_meeting.upload')}
              </MeetingButton>
            )}
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
      {!compact && (
        <Modal
          visible={model.files.open}
          animationType="slide"
          onRequestClose={() => model.files.setOpen(false)}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: '#202020', padding: 20 }}>
            <MeetingButton onPress={() => model.files.setOpen(false)}>
              {t('common.close')}
            </MeetingButton>
            <Text style={{ color: '#eee', fontSize: 20 }}>{t('shared_meeting.files')}</Text>
            {model.files.error && (
              <Text accessibilityRole="alert" style={{ color: '#FF8888' }}>
                {t('shared_meeting.files_error')}
              </Text>
            )}
            <MeetingButton disabled={model.files.busy} onPress={() => void model.files.list()}>
              {t('native_navigation.refresh')}
            </MeetingButton>
            {!model.files.busy && !model.files.files.length && (
              <Text style={{ color: '#aaa', padding: 12 }}>{t('shared_meeting.files_empty')}</Text>
            )}
            <ScrollView>
              {model.files.files.map((name) => (
                <MeetingButton
                  key={name}
                  disabled={model.files.busy}
                  onPress={() => void model.files.download(name)}
                >
                  {name}
                </MeetingButton>
              ))}
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}
    </>
  );
}
