'use client';
import * as React from 'react';
import { useWidgets } from '@/components/Widgets/hooks/useWidgets';
import mobile from '@/styles/mobile.module.scss';
import { SvgResource } from '@/components/Icon/index';
import { FlotLayoutProps, FlotLayoutExports, FlotAppItem } from '@/components/Widgets/item';
import { Button, Drawer } from 'antd';
import { DEFAULT_DRAWER_PROP, DrawerCloser } from '../Drawer/tools';
import { getParticipantPlatformInfo } from '@/lib/hooks/platform';
import { AICutAnalysisMdTabs } from './aiAnalysisMd';
import styles from  "./index.module.scss"

export * from '@/components/Widgets/item';
export const FlotLayout = React.forwardRef<FlotLayoutExports, FlotLayoutProps>(
  function FlotLayout(props, ref) {
    const model = useWidgets(props, ref);
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
      ref: FloatLayoutRef,
      flotAppItemRef,
      AICutAnalysisMdTabsRef,
      setContainerHeight,
      localParticipant,
      targetParticipant,
      isSelf,
      remoteAnalysisRes,
      toPersonalPlatform,
    } = model;

    return (
      <Drawer
        {...DEFAULT_DRAWER_PROP}
        open={openApp}
        onClose={() => setOpenApp(false)}
        width={model.device === 'phone' ? '100%' : showAI ? 1168 : 420}
        rootClassName={model.device === 'phone' ? mobile.drawer : undefined}
        title={
          <span>
            Widgets{' '}
            {model.isAuthed && (
              <Button type="text" onClick={toPersonalPlatform}>
                <SvgResource type="share" svgSize={16} />
              </Button>
            )}
          </span>
        }
        extra={DrawerCloser({ on_clicked: () => setOpenApp(false) })}
        styles={{
          body: {
            padding: model.device === 'phone' ? 0 : '0 24px',
            display: 'block',
            overflowY: 'auto',
          },
        }}
      >
        {model.device === 'phone' && (
          <div className={mobile.surface}>
            <div style={{ padding: '16px 16px 0', fontWeight: 600, overflowWrap: 'anywhere' }}>
              {model.targetParticipant.participantName || model.localParticipant.name}
            </div>
            {model.showAI && (
              <nav className={mobile.tabs}>
                <button
                  type="button"
                  className={mobile.tab}
                  aria-pressed={model.phonePanel === 'apps'}
                  onClick={() => model.setPhonePanel('apps')}
                >
                  Widgets
                </button>
                <button
                  type="button"
                  className={mobile.tab}
                  aria-pressed={model.phonePanel === 'ai'}
                  onClick={() => model.setPhonePanel('ai')}
                >
                  AI
                </button>
              </nav>
            )}
          </div>
        )}
        <div
          className={model.device === 'phone' ? mobile.surface : undefined}
          style={{
            display: model.device === 'phone' ? 'block' : 'grid',
            gridTemplateColumns: showAI ? 'minmax(0,2fr) minmax(0,1fr)' : 'minmax(0,1fr)',
            gap: 8,
            height: '100%',
          }}
        >
          {showAI && (
            <section
              className={styles.ai}
              style={{
                display: model.device === 'phone' && model.phonePanel !== 'ai' ? 'none' : undefined,
                minWidth: 0,
              }}
            >
              <AICutAnalysisMdTabs
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
              ></AICutAnalysisMdTabs>
            </section>
          )}
          <section
            style={{
              display:
                model.device === 'phone' && model.phonePanel === 'ai' && showAI
                  ? 'none'
                  : undefined,
              minWidth: 0,
              overflowY: 'auto',
            }}
          >
            <FlotAppItem
              ref={flotAppItemRef}
              messageApi={messageApi}
              apps={spaceInfo.apps}
              space={space}
              spaceInfo={spaceInfo}
              onHeightChange={setContainerHeight}
              participantId={targetParticipant.participantId || localParticipant.identity}
              isSelf={isSelf}
            />
          </section>
        </div>
      </Drawer>
    );
  },
);
