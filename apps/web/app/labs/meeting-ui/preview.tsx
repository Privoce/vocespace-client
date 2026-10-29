'use client';

import { useState } from 'react';
import {
  PhoneMeeting,
  MemberActions,
  FebType,
  type MeetingTile,
  FeedbackForm,
  MeetingShare,
  MeetingDock,
  MeetingParticipantTools,
  GeneralSettingsContent,
  AuthSettingsContent,
  MeetingControls,
  MeetingChat,
  MeetingMembers,
  MeetingMenu,
  type MeetingAction,
  type MeetingChatMessage,
} from '@vocespace/ui';
import {
  MeetingButton as Button,
  MeetingIcon as Icon,
  MeetingInput as Input,
  MeetingSettingsInput,
} from '@/components/MeetingUI/primitives';
import { Button as AntButton, Switch, Select, Radio } from 'antd';
import phoneStyles from '@/components/Settings/phone.module.scss';
import { settingsElements } from '@/components/Settings/phone-content';
import { SettingsPhone } from '@/components/Settings/phone';
import { PhoneSheet } from '@/components/MeetingUI/PhoneSheet';
import { SvgResource } from '@/components/Icon';
import { useI18n } from '@/lib/i18n/i18n';

/** Local-only fixture: actions exercise presentation, never RTC or network. */
export default function Preview() {
  const { t } = useI18n();
  const [panel, setPanel] = useState('stage');
  const [selectedMember, setSelectedMember] = useState<MeetingTile>();
  const [raised, setRaised] = useState(false);
  const [draft, setDraft] = useState('');
  const [settingsPanel, setSettingsPanel] = useState<string>();
  const [count, setCount] = useState(6);
  const [fullscreen, setFullscreen] = useState<string>();
  const [microphone, setMicrophone] = useState(false);
  const [messages, setMessages] = useState<MeetingChatMessage[]>([
    { id: '1', name: 'Lin', text: '晚上好，听得到吗？ 👋', local: false, time: '22:19' },
    { id: '2', name: 'Mia', text: '听得到，声音很清楚！', local: false, time: '22:19' },
  ]);
  const members = Array.from({ length: count }, (_, index) => ({
    id: String(index),
    name: ['访客', 'Lin', 'Mia'][index] || `Guest ${index}`,
    microphone: index === 0 && microphone,
    speaking: index === 0 && microphone,
    status: t('settings.general.status.online'),
    owner: index === 0,
    local: index === 0,
    raiseHand: index === 0 && raised,
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
    {
      id: 'screen',
      icon: 'screen',
      label: t('common.share_screen'),
      disabled: true,
      onPress: () => {},
    },
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
      id: 'feedback',
      icon: 'chat',
      label: t('channel.feedback.title'),
      onPress: () => setPanel('feedback'),
    },
    {
      id: 'hand',
      icon: 'hand',
      label: t(raised ? 'more.app.raise.cancel' : 'phone_meeting.hand'),
      description: t('phone_meeting.hand_hint'),
      onPress: () => {
        setRaised((value) => !value);
        setPanel('stage');
      },
    },
    {
      id: 'share',
      icon: 'link',
      label: t('phone_meeting.share'),
      description: t('phone_meeting.share_hint'),
      onPress: () => setPanel('share'),
    },
    {
      id: 'apps',
      icon: 'app',
      label: t('more.app.title'),
      description: t('phone_meeting.apps_hint'),
      onPress: () => {
        setSettingsPanel('app');
        setPanel('settings');
      },
    },
    {
      id: 'settings',
      icon: 'settings',
      label: t('common.setting'),
      description: t('phone_meeting.settings_hint'),
      onPress: () => {
        setSettingsPanel(undefined);
        setPanel('settings');
      },
    },
    {
      id: 'members',
      icon: 'members',
      label: t('phone_meeting.members'),
      description: t('phone_meeting.members_count').replace('$count', String(count)),
      onPress: () => setPanel('members'),
    },
  ];
  const send = () => {
    if (!draft.trim()) return;
    setMessages([
      ...messages,
      { id: String(Date.now()), name: '访客', text: draft, local: true, time: '22:20' },
    ]);
    setDraft('');
  };
  const chatProps = {
    Button,
    Icon,
    Input,
    messages,
    draft,
    onDraft: setDraft,
    onSend: send,
    maxLength: 4000,
    placeholder: t('phone_meeting.chat_placeholder'),
    sendLabel: t('common.send'),
    emptyLabel: t('shared_meeting.empty_chat'),
  };
  const memberProps = {
    Button,
    Icon,
    members,
    hostLabel: t('more.participant.host'),
    selfLabel: t('phone_meeting.self'),
    speakingLabel: t('phone_meeting.speaking'),
    onlineLabel: t('phone_meeting.online'),
  };
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
        <button onClick={() => { setSelectedMember(members[1]); setPanel('member-actions'); }}>{t('moderation.title')}</button>
      </div>
      <div style={{ width: '100%', maxWidth: 430, flex: 1, minHeight: 0, display: 'flex' }}>
        <PhoneMeeting
          handLabel={t('more.app.raise.title')}
          lowerHandLabel={t('more.app.raise.cancel')}
          onLowerHand={() => setRaised(false)}
          renderSheet={(props) => <PhoneSheet {...props}>{props.content}</PhoneSheet>}
          fullscreenTileId={fullscreen}
          name="mobile-test"
          status={`${count} ${t('channel.menu.active')}`}
          labels={{
            grid: t('phone_meeting.grid'),
            focusLayout: t('phone_meeting.focus_layout'),
            page: t('phone_meeting.page'),
            previous: t('shared_meeting.previous'),
            next: t('shared_meeting.next'),
            focus: t('phone_meeting.focus_layout'),
            unfocus: t('shared_meeting.unfocus'),
            cameraOff: t('shared_meeting.camera_off'),
            empty: t('shared_meeting.empty'),
            chat: t('common.chat'),
            close: t('common.close'),
          }}
          tiles={members}
          onMemberLongPress={(member) => { setSelectedMember(member); setPanel('member-actions'); }}
          Button={Button}
          Icon={Icon}
          renderVideo={() => null}
          headerActions={[
            {
              id: 'share',
              icon: 'link',
              label: t('phone_meeting.share'),
              onPress: () => setPanel('share'),
            },
            menu.find((item) => item.id === 'members')!,
          ]}
          renderTileActions={(item, focused, toggle) => (
            <MeetingParticipantTools
              Button={Button}
              Icon={Icon}
              focused={focused}
              fullscreen={fullscreen === item.id}
              onFocus={() => {
                setFullscreen(undefined);
                toggle();
              }}
              onFullscreen={() => setFullscreen(fullscreen === item.id ? undefined : item.id)}
              onAvatar={
                item.local
                  ? () => {
                      setSettingsPanel('profile');
                      setPanel('settings');
                    }
                  : undefined
              }
              onApps={() => setPanel('settings')}
              labels={{
                focus: t('phone_meeting.focus_layout'),
                unfocus: t('phone_meeting.grid'),
                fullscreen: t('common.full_screen'),
                exitFullscreen: t('phone_meeting.exit_fullscreen'),
                avatar: t('phone_meeting.avatar'),
                apps: t('more.app.title'),
              }}
            />
          )}
          dock={
            <MeetingDock
              Button={Button}
              Icon={Icon}
              chatLabel={t('common.chat')}
              membersLabel={t('phone_meeting.members')}
              expandLabel={t('common.full_screen')}
              count={members.length}
              unread={messages.length}
              onExpand={setPanel}
              chat={<MeetingChat {...chatProps} compact />}
              members={<MeetingMembers {...memberProps} compact />}
            />
          }
          controls={<MeetingControls Button={Button} Icon={Icon} actions={actions} />}
          chat={{
            open: panel === 'chat',
            onClose: () => setPanel('stage'),
            content: (
              <MeetingChat
                {...chatProps}
                roomName="mobile-test"
                roomSubtitle={t('phone_meeting.chat_hint')}
              />
            ),
          }}
          panel={{
            open: ['members', 'more', 'settings', 'share', 'feedback', 'member-actions', 'report'].includes(panel),
            height:
              panel === 'member-actions' ? '58%' : panel === 'more' || panel === 'share' ? '76%' : panel === 'members' ? '62%' : '88%',
            title:
              panel === 'member-actions' ? t('moderation.title') : panel === 'report' ? t('moderation.report.title') : panel === 'feedback'
                ? t('channel.feedback.title')
                : panel === 'members'
                  ? t('phone_meeting.members')
                  : panel === 'share'
                    ? t('phone_meeting.share')
                    : panel === 'settings'
                      ? settingsPanel
                        ? t(
                            settingsPanel === 'app'
                              ? 'more.app.title'
                              : settingsPanel === 'recording'
                                ? 'recording.title'
                                : `settings.${settingsPanel}.title`,
                          )
                        : t('settings.title')
                      : t('phone_meeting.more_title'),
            subtitle:
              panel === 'more'
                ? undefined
                : panel === 'members'
                  ? t('phone_meeting.members_count').replace('$count', String(count))
                  : undefined,
            backLabel: t('common.back'),
            onBack:
              panel === 'settings' && settingsPanel ? () => setSettingsPanel(undefined) : undefined,
            onClose: () => setPanel('stage'),
            content:
              panel === 'member-actions' && selectedMember ? (
                <MemberActions name={selectedMember.name} status={selectedMember.status} canBlock t={t} Button={Button} Icon={Icon}
                  onBlock={() => {}} onReport={() => setPanel('report')} />
              ) : panel === 'feedback' || panel === 'report' ? (
                <FeedbackForm
                  t={t}
                  varient={panel === 'report' ? FebType.Report : FebType.Feedback}
                  target={selectedMember ? { id: selectedMember.id, name: selectedMember.name, spaceName: 'mobile-test' } : undefined}
                  accountEmail="preview@example.test"
                  Button={Button}
                  Input={MeetingSettingsInput}
                  onUpload={async () => undefined}
                  onSubmit={async () => {
                    throw new Error('PREVIEW_ONLY');
                  }}
                  onDone={() => setPanel('stage')}
                />
              ) : panel === 'share' ? (
                <MeetingShare
                  Button={Button}
                  Icon={Icon}
                  name="mobile-test"
                  title={t('phone_meeting.share_title')}
                  description={t('phone_meeting.share_description')}
                  copyLabel={t('phone_meeting.copy')}
                  onCopy={() => {
                    void navigator.clipboard.writeText('mobile-test');
                  }}
                />
              ) : panel === 'settings' ? (
                <div className={phoneStyles.phone} style={{ overflowY: 'auto', height: '100%' }}>
                  <SettingsPhone
                    model={{
                      username: '访客',
                      localParticipant: { identity: '0' },
                      space: { name: 'mobile-test' },
                      spaceInfo: { ownerId: '0' },
                      phonePanelOpen: !!settingsPanel,
                      key: settingsPanel || 'general',
                      t,
                      selectPanel: setSettingsPanel,
                      setPhonePanelOpen: () => setSettingsPanel(undefined),
                      showAI: false,
                    }}
                  />
                  {settingsPanel === 'general' && (
                    <div style={{ padding: 22 }}>
                      {GeneralSettingsContent({
                        elements: settingsElements,
                        styles: {},
                        t,
                        owner: true,
                        slots: {
                          introIcon: <SvgResource type="setting" svgSize={24} color="#22CCEE" />,
                          language: (
                            <Select
                              style={{ width: '100%' }}
                              value="zh"
                              options={[{ value: 'zh', label: '简体中文' }]}
                            />
                          ),
                          status: (
                            <MeetingSettingsInput
                              value={draft}
                              onChangeText={setDraft}
                              placeholder={t('phone_meeting.online')}
                              onSubmit={() => {}}
                            />
                          ),
                          saveStatus: (
                            <AntButton type="primary" size="large">
                              {t('settings.general.status.define.save')}
                            </AntButton>
                          ),
                          prompt: <Switch checked={microphone} onChange={setMicrophone} />,
                          persistence: <Switch defaultChecked />,
                          guests: (
                            <Radio.Group
                              defaultValue="allow"
                              style={{ display: 'flex', flexDirection: 'column' }}
                            >
                              {['allow', 'link', 'disable'].map((value) => (
                                <Radio key={value} value={value}>
                                  {t(`settings.general.conf.allow_guest.${value}`)}
                                </Radio>
                              ))}
                            </Radio.Group>
                          ),
                          dashboard: null,
                        },
                      })}
                    </div>
                  )}
                  {settingsPanel === 'auth' && (
                    <div style={{ padding: 22 }}>
                      {AuthSettingsContent({
                        elements: settingsElements,
                        styles: {},
                        t,
                        slots: {
                          introIcon: <SvgResource type="auth" svgSize={24} color="#22CCEE" />,
                          microphone: <Switch checked={microphone} onChange={setMicrophone} />,
                          camera: <Switch disabled />,
                          table: null,
                          save: null,
                          management: (
                            <Button onPress={() => setSettingsPanel('general')}>
                              {t('phone_meeting.manage_permissions')}
                            </Button>
                          ),
                        },
                      })}
                    </div>
                  )}
                </div>
              ) : panel === 'members' ? (
                <MeetingMembers
                  {...memberProps}
                  inviteLabel={t('phone_meeting.invite')}
                  onInvite={() => setPanel('share')}
                />
              ) : (
                <MeetingMenu
                  Button={Button}
                  Icon={Icon}
                  actions={menu}
                  footer={t('phone_meeting.media_hint')}
                />
              ),
          }}
        />
      </div>
    </main>
  );
}
