import mobile from '@/features/shared/mobile.module.scss';
import type { FlotLayoutModel } from './pc';

/** The panels stay mounted below this phone navigation to retain drafts and timers. */
export function FlotLayoutPhone({ model }: { model: FlotLayoutModel }) {
  return <div className={mobile.surface}>
    <div style={{ padding: '16px 16px 0', fontWeight: 600, overflowWrap: 'anywhere' }}>{model.targetParticipant.participantName || model.localParticipant.name}</div>
    {model.showAI && <nav className={mobile.tabs}>
      <button type="button" className={mobile.tab} aria-pressed={model.phonePanel === 'apps'} onClick={() => model.setPhonePanel('apps')}>Widgets</button>
      <button type="button" className={mobile.tab} aria-pressed={model.phonePanel === 'ai'} onClick={() => model.setPhonePanel('ai')}>AI</button>
    </nav>}
  </div>;
}
