'use client';

import { useState } from 'react';
import {
  PhoneMeeting,
  MeetingControls,
  MeetingChat,
  MeetingMembers,
  MeetingMenu,
  MeetingSettingsNavigation,
  MeetingSettingsForm,
  type MeetingAction,
  type MeetingChatMessage,
} from '@vocespace/ui';
import {
  MeetingButton as Button,
  MeetingIcon as Icon,
  MeetingInput as Input,
  MeetingSettingsInput,
} from '@/components/MeetingUI/primitives';
import { useI18n } from '@/lib/i18n/i18n';

/** Local-only fixture: actions exercise presentation, never RTC or network. */
export default function Preview() {
  const { t } = useI18n();
  const [panel, setPanel] = useState('stage');
  const [draft, setDraft] = useState('');
  const [settingsPanel, setSettingsPanel] = useState<string>();
  const [count, setCount] = useState(2);
  const [microphone, setMicrophone] = useState(false);
  const [messages, setMessages] = useState<MeetingChatMessage[]>([]);
  const members = Array.from({ length: count }, (_, index) => ({
    id: String(index),
    name: `${t('shared_meeting.preview')} ${index + 1}`,
    microphone: index === 0 && microphone,
    speaking: index === 0 && microphone,
    status: t('settings.general.status.online'),
    role: index === 0 ? '👑' : undefined,
  }));
  const actions: MeetingAction[] = [
    {
      id: 'mic',
      icon: 'microphone',
      label: t('common.device.microphone'),
      active: microphone,
      muted: !microphone,
      onPress: () => setMicrophone(!microphone),
    },
    {
      id: 'camera',
      icon: 'camera',
      label: t('common.device.camera'),
      disabled: true,
      muted: true,
      onPress: () => {},
    },
    { id: 'chat', icon: 'chat', label: t('common.chat'), onPress: () => setPanel('chat') },
    { id: 'more', icon: 'more', label: t('more.title'), onPress: () => setPanel('more') },
    {
      id: 'leave',
      icon: 'leave',
      label: t('common.leave'),
      danger: true,
      onPress: () => {
        setPanel('stage');
        setMicrophone(false);
      },
    },
  ];
  const menu: MeetingAction[] = [
    {
      id: 'settings',
      icon: 'settings',
      label: t('common.setting'),
      onPress: () => {
        setSettingsPanel(undefined);
        setPanel('settings');
      },
    },
    {
      id: 'members',
      icon: 'members',
      label: t('more.participant.title'),
      onPress: () => setPanel('members'),
    },
  ];
  return (
    <main
      style={{
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: '#0B1015',
      }}
    >
      <div style={{ color: '#aaa', fontSize: 11, padding: 8 }}>
        {t('shared_meeting.preview_note')}{' '}
        <button onClick={() => setCount(count === 2 ? 6 : 2)}>2 / 6</button>
      </div>
      <div style={{ width: '100%', maxWidth: 430, flex: 1, minHeight: 0, display: 'flex' }}>
        <PhoneMeeting
          name="mobile-test"
          status={`${count} ${t('channel.menu.active')}`}
          labels={{
            previous: t('shared_meeting.previous'),
            next: t('shared_meeting.next'),
            focus: t('shared_meeting.focus'),
            unfocus: t('shared_meeting.unfocus'),
            cameraOff: t('shared_meeting.camera_off'),
            empty: t('shared_meeting.empty'),
            chat: t('common.chat'),
            close: t('common.close'),
          }}
          tiles={members}
          Button={Button}
          Icon={Icon}
          renderVideo={() => null}
          headerActions={menu}
          controls={<MeetingControls Button={Button} Icon={Icon} actions={actions} />}
          chat={{
            open: panel === 'chat',
            onClose: () => setPanel('stage'),
            content: (
              <MeetingChat
                Button={Button}
                Icon={Icon}
                Input={Input}
                messages={messages}
                draft={draft}
                onDraft={setDraft}
                onSend={() => {
                  if (!draft.trim()) return;
                  setMessages([
                    ...messages,
                    {
                      id: String(messages.length),
                      name: t('shared_meeting.preview'),
                      text: draft,
                      local: true,
                    },
                  ]);
                  setDraft('');
                }}
                maxLength={4000}
                placeholder={t('common.chat_placeholder')}
                sendLabel={t('common.send')}
                emptyLabel={t('shared_meeting.empty_chat')}
              />
            ),
          }}
          panel={{
            open: panel === 'members' || panel === 'more' || panel === 'settings',
            title: t(
              panel === 'members'
                ? 'more.participant.title'
                : panel === 'settings'
                  ? 'common.setting'
                  : 'more.title',
            ),
            onClose: () => setPanel('stage'),
            content:
              panel === 'settings' ? (
                <div style={{ overflowY: 'auto', height: '100%' }}>
                  <MeetingSettingsNavigation
                    name={t('shared_meeting.preview')}
                    spaceName="mobile-test"
                    panels={[
                      { id: 'general', label: t('settings.general.title'), group: 'general' },
                      { id: 'audio', label: t('settings.audio.title'), group: 'media' },
                      { id: 'video', label: t('settings.video.title'), group: 'media' },
                    ]}
                    activePanel={settingsPanel}
                    onSelect={setSettingsPanel}
                    onBack={() => setSettingsPanel(undefined)}
                    backLabel={t('common.back')}
                    Button={Button}
                    Icon={Icon}
                  />
                  {settingsPanel && (
                    <MeetingSettingsForm
                      Button={Button}
                      Input={MeetingSettingsInput}
                      fields={
                        settingsPanel === 'general'
                          ? [
                              {
                                id: 'room',
                                kind: 'value',
                                label: t('shared_meeting.preview'),
                                value: 'mobile-test',
                                description: t('shared_meeting.preview_note'),
                              },
                            ]
                          : [
                              {
                                id: 'device',
                                kind: 'toggle',
                                label: t(
                                  settingsPanel === 'audio'
                                    ? 'common.device.microphone'
                                    : 'common.device.camera',
                                ),
                                value: settingsPanel === 'audio' && microphone,
                                disabled: settingsPanel === 'video',
                                onChange: setMicrophone,
                                onLabel: t('common.open'),
                                offLabel: t('common.close'),
                              },
                            ]
                      }
                    />
                  )}
                </div>
              ) : panel === 'members' ? (
                <MeetingMembers Button={Button} Icon={Icon} members={members} />
              ) : (
                <MeetingMenu Button={Button} Icon={Icon} actions={menu} />
              ),
          }}
        />
      </div>
    </main>
  );
}
