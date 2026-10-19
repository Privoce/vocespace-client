import { PhoneSettingsNavigation } from '@vocespace/ui';
import type { SettingsModel } from './panels';
import { getSettingsPanels } from './panels';
export function SettingsPhone({ model }: { model: SettingsModel }) {
  return (
    <PhoneSettingsNavigation
      name={model.username || model.localParticipant.identity}
      spaceName={model.space.name}
      panels={getSettingsPanels(model).map((panel) => ({ id: panel.key, label: panel.label }))}
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
