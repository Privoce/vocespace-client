import { FileAttachment } from './FileAttachment';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconOutline } from '@ant-design/icons-react-native';
import { useI18n } from '../i18n';
import { View, Text, Modal, ScrollView, Image } from 'react-native';
import { MeetingChat } from '@vocespace/ui';
import { CONFERENCE_MESSAGE_LIMIT } from '@vocespace/contracts';
import { MeetingButton, MeetingIcon, MeetingInput } from '../ui/meeting';
import type { useConferenceChat } from './hooks/useConferenceChat';
export function SharedConferenceChat({
  model,
  identity,
  compact,
  roomName,
  onToggleTools,
  toolsOpen,
}: {
  model: ReturnType<typeof useConferenceChat>;
  identity: string;
  compact?: boolean;
  roomName?: string;
  onToggleTools: () => void;
  toolsOpen?: boolean;
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
              item.file ? (
                <FileAttachment
                  name={item.file.name}
                  storageName={item.file.storageName}
                  files={model.files}
                />
              ) : (
                <MeetingButton onPress={() => void model.files.list()}>
                  {t('shared_meeting.files')}
                </MeetingButton>
              )
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
        onComposerFocus={() => {
          if (toolsOpen) onToggleTools();
        }}
        composerTools={
          <MeetingButton
            label={t('more.app.title')}
            appearance="icon"
            active={toolsOpen}
            onPress={onToggleTools}
          >
            <IconOutline name="plus-circle" size={24} color={toolsOpen ? '#22ccee' : '#adc1cd'} />
          </MeetingButton>
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
      <Modal
        visible={model.files.open || !!model.files.preview}
        transparent
        animationType="fade"
        onRequestClose={() =>
          model.files.preview ? model.files.setPreview(undefined) : model.files.setOpen(false)
        }
      >
        <SafeAreaView
          style={{
            flex: 1,
            backgroundColor: model.files.preview ? '#111' : '#0009',
            justifyContent: 'center',
            padding: model.files.preview ? 0 : 16,
          }}
        >
          <View
            style={{
              backgroundColor: '#202020',
              borderRadius: 8,
              padding: 16,
              ...(model.files.preview ? { flex: 1 } : { maxHeight: '80%' as const }),
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <Text
                numberOfLines={1}
                style={{ color: '#eee', fontSize: 18, fontWeight: '600', flex: 1 }}
              >
                {model.files.preview?.name || t('shared_meeting.files')}
              </Text>
              <MeetingButton
                appearance="icon"
                label={t('common.close')}
                onPress={() =>
                  model.files.preview
                    ? model.files.setPreview(undefined)
                    : model.files.setOpen(false)
                }
              >
                <MeetingIcon name="close" />
              </MeetingButton>
            </View>
            {model.files.error && (
              <Text style={{ color: '#FF8888' }}>{t('shared_meeting.files_error')}</Text>
            )}
            {model.files.preview ? (
              <Image
                source={{ uri: model.files.preview.url }}
                style={{ flex: 1 }}
                resizeMode="contain"
                onError={model.files.onPreviewError}
              />
            ) : (
              <ScrollView
                style={{ backgroundColor: '#191919', borderRadius: 8 }}
                contentContainerStyle={{ padding: 12 }}
              >
                {!model.files.busy && !model.files.files.length && (
                  <Text style={{ color: '#aaa', padding: 12 }}>
                    {t('shared_meeting.files_empty')}
                  </Text>
                )}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {model.files.files.map((name) => (
                    <View key={name} style={{ width: '50%', padding: 4 }}>
                      <FileAttachment
                        gallery
                        name={model.files.names[name] || name}
                        storageName={name}
                        files={model.files}
                      />
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}
