/** Development-only presentation harness. No account, API, RTC or device acquisition. */
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  PhoneMeeting,
  MeetingControls,
  MeetingMenu,
  MeetingMembers,
  MeetingChat,
  MeetingDock,
  MeetingShare,
  PhoneSettingsNavigation,
  MeetingTileActions,
  GeneralSettingsContent,
  AuthSettingsContent,
  type MeetingAction,
} from '@vocespace/ui';
import { MeetingButton as Button, MeetingIcon as Icon, MeetingInput as Input } from '../ui/meeting';
import { PhoneSettingsButton } from '../ui/settings';
import { SettingsIcon } from '../ui/SettingsIcon';
import {
  SettingsSelect,
  SettingsToggle,
  SettingsChoice,
  Input as SettingsInput,
} from '../ui/settings-widgets';
import { createSettingsElements, settingsStyleNames } from '../ui/settings-elements';
import { useI18n } from '../i18n';

const settingsElements = createSettingsElements(() => {});
const panels = [
  ['general', 'setting'],
  ['profile', 'smile'],
  ['auth', 'auth'],
  ['audio', 'audio'],
  ['video', 'video'],
  ['app', 'app'],
  ['recording', 'record'],
  ['license', 'license'],
  ['about_us', 'logo'],
] as const;
export default function MeetingPreview() {
  const { t } = useI18n();
  const [panel, setPanel] = useState('stage');
  const [raised, setRaised] = useState(false);
  const [selected, select] = useState<string>();
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('在线');
  const [mic, setMic] = useState(false);
  const [guest, setGuest] = useState('allow');
  const [messages, setMessages] = useState([
    { id: '1', name: 'Lin', text: '晚上好，听得到吗？ 👋', local: false, time: '22:19' },
    { id: '2', name: 'Mia', text: '听得到，声音很清楚！', local: false, time: '22:19' },
  ]);
  const members = ['访客', 'Lin', 'Mia'].map((name, index) => ({
    id: String(index),
    name,
    local: index === 0,
    raiseHand: index === 0 && raised,
    owner: index === 0,
    speaking: index === 1,
    microphone: index === 1,
    status: t('phone_meeting.online'),
  }));
  const actions: MeetingAction[] = [
    {
      id: 'mic',
      icon: 'microphone',
      label: t('common.device.microphone'),
      active: mic,
      muted: !mic,
      onPress: () => setMic(!mic),
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
      onPress: () => setPanel('stage'),
    },
  ];
  const menu: MeetingAction[] = [
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
      id: 'members',
      icon: 'members',
      label: t('phone_meeting.members'),
      description: '3 人在线',
      onPress: () => setPanel('members'),
    },
    {
      id: 'apps',
      icon: 'app',
      label: t('more.app.title'),
      description: t('phone_meeting.apps_hint'),
      onPress: () => {
        select('app');
        setPanel('settings');
      },
    },
    {
      id: 'settings',
      icon: 'settings',
      label: t('settings.title'),
      description: t('phone_meeting.settings_hint'),
      onPress: () => {
        select(undefined);
        setPanel('settings');
      },
    },
  ];
  const chatProps = {
    Button,
    Icon,
    Input,
    messages,
    draft,
    onDraft: setDraft,
    onSend: () => {
      if (!draft.trim()) return;
      setMessages([
        ...messages,
        { id: String(Date.now()), name: '访客', text: draft, local: true, time: '22:20' },
      ]);
      setDraft('');
    },
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
  const common = { t, elements: settingsElements, styles: settingsStyleNames };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B1015' }}>
      <Text style={{ color: '#829EAE', fontSize: 10, textAlign: 'center', padding: 4 }}>
        {t('shared_meeting.preview_note')}
      </Text>
      <PhoneMeeting
        handLabel={t('more.app.raise.title')}
        lowerHandLabel={t('more.app.raise.cancel')}
        onLowerHand={() => setRaised(false)}
        name="mobile-test"
        status="3 在线"
        labels={{
          grid: t('phone_meeting.grid'),
          focusLayout: t('phone_meeting.focus_layout'),
          page: t('phone_meeting.page'),
          previous: t('shared_meeting.previous'),
          next: t('shared_meeting.next'),
          focus: t('shared_meeting.focus'),
          unfocus: t('shared_meeting.unfocus'),
          cameraOff: t('shared_meeting.camera_off'),
          empty: t('shared_meeting.empty'),
          chat: t('phone_meeting.chat'),
          close: t('common.close'),
        }}
        Button={Button}
        Icon={Icon}
        tiles={members}
        renderVideo={() => null}
        headerActions={[menu[1], menu[2]]}
        renderTileActions={(item, focused, toggle) => (
          <MeetingTileActions
            Button={Button}
            Icon={Icon}
            actions={[
              {
                id: 'focus',
                icon: focused ? 'unfocus' : 'focus',
                label: t('shared_meeting.focus'),
                onPress: toggle,
              },
              {
                id: 'fullscreen',
                icon: 'fullscreen',
                label: t('common.full_screen'),
                onPress: toggle,
              },
              {
                id: 'apps',
                icon: 'app',
                label: t('more.app.title'),
                onPress: () => setPanel('settings'),
              },
            ]}
          />
        )}
        controls={<MeetingControls Button={Button} Icon={Icon} actions={actions} />}
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
          backLabel: t('common.back'),
          open: ['more', 'share', 'members', 'settings'].includes(panel),
          title:
            panel === 'more'
              ? t('phone_meeting.more_title')
              : panel === 'share'
                ? t('phone_meeting.share')
                : panel === 'members'
                  ? t('phone_meeting.members')
                  : selected
                    ? t(
                        selected === 'app'
                          ? 'more.app.title'
                          : selected === 'recording'
                            ? 'recording.title'
                            : `settings.${selected}.title`,
                      )
                    : t('settings.title'),
          subtitle: panel === 'more' ? t('phone_meeting.more_subtitle') : undefined,
          height:
            panel === 'more' || panel === 'share' ? '76%' : panel === 'members' ? '62%' : '88%',
          onClose: () => setPanel('stage'),
          onBack: panel === 'settings' && selected ? () => select(undefined) : undefined,
          content:
            panel === 'more' ? (
              <MeetingMenu
                Button={Button}
                Icon={Icon}
                actions={menu}
                footer={t('phone_meeting.media_hint')}
              />
            ) : panel === 'share' ? (
              <MeetingShare
                Button={Button}
                Icon={Icon}
                name="mobile-test"
                title={t('phone_meeting.share_title')}
                description={t('phone_meeting.share_description')}
                copyLabel={t('phone_meeting.copy')}
                onCopy={() => {}}
              />
            ) : panel === 'members' ? (
              <MeetingMembers
                {...memberProps}
                inviteLabel={t('phone_meeting.invite')}
                onInvite={() => setPanel('share')}
              />
            ) : (
              <ScrollView>
                <PhoneSettingsNavigation
                  hideHeader
                  name="访客"
                  hostLabel={t('more.participant.host')}
                  onlineLabel={t('phone_meeting.online')}
                  spaceName="mobile-test"
                  groupLabels={[
                    t('phone_meeting.preferences'),
                    t('phone_meeting.devices'),
                    t('more.title'),
                  ]}
                  panels={panels.map(([id, name]) => ({
                    id,
                    label: (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                        <SettingsIcon name={name} size={20} color="#9CB3C0" />
                        <Text style={{ color: '#E7EDF5' }}>
                          {t(
                            id === 'app'
                              ? 'more.app.title'
                              : id === 'recording'
                                ? 'recording.title'
                                : `settings.${id}.title`,
                          )}
                        </Text>
                      </View>
                    ),
                  }))}
                  activePanel={selected}
                  onSelect={select}
                  onBack={() => select(undefined)}
                  backLabel={t('common.back')}
                />
                {selected === 'general' && (
                  <View style={{ padding: 20 }}>
                    {GeneralSettingsContent({
                      ...common,
                      owner: true,
                      slots: {
                        introIcon: <SettingsIcon name="setting" size={24} color="#22CCEE" />,
                        language: (
                          <SettingsSelect
                            value="zh"
                            label={t('settings.general.lang')}
                            options={[{ value: 'zh', label: '简体中文' }]}
                          />
                        ),
                        status: <SettingsInput value={status} onChangeText={setStatus} />,
                        saveStatus: (
                          <PhoneSettingsButton tone="primary">
                            {t('settings.general.status.define.save')}
                          </PhoneSettingsButton>
                        ),
                        prompt: <SettingsToggle value={mic} onChange={setMic} />,
                        persistence: <SettingsToggle value />,
                        guests: (
                          <SettingsChoice
                            vertical
                            value={guest}
                            options={['allow', 'link', 'disable'].map((value) => ({
                              value,
                              label: t(`settings.general.conf.allow_guest.${value}`),
                            }))}
                            onChange={(value) => setGuest(String(value))}
                          />
                        ),
                        dashboard: null,
                      },
                    })}
                  </View>
                )}
                {selected === 'auth' && (
                  <View style={{ padding: 20 }}>
                    {AuthSettingsContent({
                      ...common,
                      slots: {
                        introIcon: <SettingsIcon name="auth" size={24} color="#22CCEE" />,
                        microphone: <SettingsToggle value={mic} onChange={setMic} />,
                        camera: <SettingsToggle value={false} disabled />,
                        table: <Text style={{ color: '#E7EDF5' }}>RBAC · UI preview</Text>,
                        save: null,
                      },
                    })}
                  </View>
                )}
              </ScrollView>
            ),
        }}
      />
    </SafeAreaView>
  );
}
