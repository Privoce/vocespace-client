import { PhoneSettingsNavigation, meetingSettingsSections } from '@vocespace/ui';
import type { SettingsModel } from './panels';
import { SvgResource } from '../Icon';
import { MeetingIcon } from '../MeetingUI/primitives';
type SettingsPhoneModel = Pick<
  SettingsModel,
  'username' | 'phonePanelOpen' | 'selectPanel' | 'setPhonePanelOpen' | 't' | 'showAI'
> & {
  key: string;
  localParticipant: Pick<SettingsModel['localParticipant'], 'identity'>;
  space: Pick<SettingsModel['space'], 'name'>;
  spaceInfo: Pick<SettingsModel['spaceInfo'], 'ownerId'>;
};
export function SettingsPhone({ model }: { model: SettingsPhoneModel }) {
  return (
    <PhoneSettingsNavigation
      name={model.username || model.localParticipant.identity}
      spaceName={model.space.name}
      panels={meetingSettingsSections
        .filter((panel) => panel.id !== 'ai' || model.showAI)
        .map((panel) => ({
          id: panel.id,
          label: model.t(panel.labelKey),
          icon: <SvgResource type={panel.icon} svgSize={20} color="#9CB3C0" />,
        }))}
      nextIcon={
        <span style={{ display: 'flex', flexShrink: 0, transform: 'rotate(180deg)' }}>
          <MeetingIcon name="back" size={16} color="#9CB3C0" />
        </span>
      }
      activePanel={model.phonePanelOpen ? model.key : undefined}
      onSelect={model.selectPanel}
      onBack={() => model.setPhonePanelOpen(false)}
      backLabel={model.t('common.back')}
      hideHeader
      groupLabels={[
        model.t('phone_meeting.preferences'),
        model.t('phone_meeting.devices'),
        model.t('more.title'),
      ]}
      hostLabel={
        model.spaceInfo.ownerId === model.localParticipant.identity
          ? model.t('more.participant.host')
          : undefined
      }
      onlineLabel={model.t('phone_meeting.online')}
    />
  );
}
