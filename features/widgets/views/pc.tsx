import { AICutAnalysisMdTabs } from '@/app/pages/apps/ai_analysis_md';
import { DEFAULT_DRAWER_PROP, DrawerCloser } from '@/app/pages/controls/drawer_tools';
import { SvgResource } from '@/app/resources/svg';
import mobile from '@/styles/mobile.module.scss';
import { FlotAppItem } from '@/features/widgets/shared';
import { getParticipantPlatformInfo } from '@/lib/hooks/platform';
import { Button, Drawer } from 'antd';
import type { useWidgets } from '../hooks/useWidgets';
import { FlotLayoutPhone } from './phone';
import phone from './phone.module.scss';
export type FlotLayoutModel = ReturnType<typeof useWidgets>;
export function FlotLayoutPC({ model }: { model: FlotLayoutModel }) {
  const {
    messageApi,
    openApp,
    spaceInfo,
    space,
    setOpenApp,
    showAICutAnalysisSettings,
    reloadResult,
    startOrStopAICutAnalysis,
    openAIServiceAskNote,
    aiCutAnalysisRes,
    cutInstance,
    showAI,
    ref,
    flotAppItemRef,
    AICutAnalysisMdTabsRef,
    setContainerHeight,
    localParticipant,
    targetParticipant,
    isSelf,
    remoteAnalysisRes,
    toPersonalPlatform,
  } = model;
  return <Drawer {...DEFAULT_DRAWER_PROP} open={openApp} onClose={() => setOpenApp(false)} width={model.device === 'phone' ? '100%' : showAI ? 1168 : 420} rootClassName={model.device === 'phone' ? mobile.drawer : undefined} title={<span>Widgets {model.isAuthed && <Button type="text" onClick={toPersonalPlatform}><SvgResource type="share" svgSize={16} /></Button>}</span>} extra={DrawerCloser({ on_clicked: () => setOpenApp(false) })} styles={{ body: { padding: model.device === 'phone' ? 0 : '0 24px', display: 'block', overflowY: 'auto' } }}>
    {model.device === 'phone' && <FlotLayoutPhone model={model} />}
    <div className={model.device === 'phone' ? mobile.surface : undefined} style={{ display: model.device === 'phone' ? 'block' : 'grid', gridTemplateColumns: showAI ? 'minmax(0,2fr) minmax(0,1fr)' : 'minmax(0,1fr)', gap: 8, height: '100%' }}>
      {showAI && <section className={phone.ai} style={{ display: model.device === 'phone' && model.phonePanel !== 'ai' ? 'none' : undefined, minWidth: 0 }}><AICutAnalysisMdTabs
        ref={AICutAnalysisMdTabsRef}
        result={isSelf ? aiCutAnalysisRes : remoteAnalysisRes}
        reloadResult={reloadResult}
        showSettings={showAICutAnalysisSettings}
        setFlotAppOpen={setOpenApp}
        spaceInfo={spaceInfo}
        startOrStopAICutAnalysis={startOrStopAICutAnalysis}
        openAIServiceAskNote={openAIServiceAskNote}
        messageApi={messageApi}
        isSelf={isSelf}
        style={{
          height: '100%',
          width: '100%',
        }}
        isAuthed={
          getParticipantPlatformInfo({
            user: spaceInfo.participants[
              targetParticipant.participantId || localParticipant.identity
            ],
          }).isAuth
        }
        cutInstance={cutInstance}
        userId={targetParticipant.participantId || localParticipant.identity}
      ></AICutAnalysisMdTabs></section>}
      <section style={{ display: model.device === 'phone' && model.phonePanel === 'ai' && showAI ? 'none' : undefined, minWidth: 0, overflowY: 'auto' }}><FlotAppItem
        ref={flotAppItemRef}
        messageApi={messageApi}
        apps={spaceInfo.apps}
        space={space}
        spaceInfo={spaceInfo}
        onHeightChange={setContainerHeight}
        participantId={targetParticipant.participantId || localParticipant.identity}
        isSelf={isSelf}
      /></section>
    </div></Drawer>;
}
