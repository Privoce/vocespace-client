import React from 'react';
import {
  ConnectionStateToast,
  LayoutContextProvider,
  RoomAudioRenderer,
  VideoConferenceProps,
  WidgetState,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { Controls, ControlBarExport } from '../bar';
import { UnifiedLayout } from '../../layout/unified';
import { PaginationControl, PaginationIndicator } from '../../layout/cover';
import { LicenseAlert } from '../widgets/license_alert';
import { ChatPanel, EnhancedChat } from '../../chat/chat';
import { isMobile } from '@/lib/browser/environment';
import { MessageInstance } from 'antd/es/message/interface';
import { ReadableConf } from '@/features/settings/config';
import {
  AICutParticipantConf,
  ParticipantSettings,
  RecordSettings,
  SpaceInfo,
} from '@/features/spaces/model';
import { UserStatus } from '@/features/room/model';
import type { TrackReferenceOrPlaceholder } from '../video_container';
import type { LayoutEntity } from '../../layout/unified';

export type VideoLayoutEntity = LayoutEntity<TrackReferenceOrPlaceholder | React.ReactNode> & {
  category: 'track' | 'tile-player' | 'tile-player-add';
};

interface VideoConferenceStageProps extends VideoConferenceProps {
  mainViewWidth: string;
  focusTrack: TrackReferenceOrPlaceholder | undefined;
  layoutContext: any;
  widgetUpdate: (state: WidgetState) => void;
  hasRoomLicense: boolean;
  toBuyRoomLicense: () => void;
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  space: import('livekit-client').Room;
  settings: SpaceInfo;
  unifiedEntities: VideoLayoutEntity[];
  unifiedFocusEntity: VideoLayoutEntity | null;
  unifiedPageSize: number;
  deviceType: 'mobile' | 'desktop';
  isFullScreen: boolean;
  renderUnifiedEntity: (entity: VideoLayoutEntity, state: { isFocus: boolean }) => React.ReactNode;
  sendFileConfirm: (
    onOk: (
      abortController?: AbortController,
    ) => Promise<import('@/features/chat/types').ChatMsgItem>,
  ) => void;
  messageApi: MessageInstance;
  controlsRef: React.RefObject<ControlBarExport>;
  setUserStatus: (status: UserStatus | string) => Promise<void>;
  updateSettings: (
    newSettings: Partial<ParticipantSettings>,
    record?: RecordSettings,
    init?: boolean,
  ) => Promise<boolean | undefined>;
  fetchSettings: () => Promise<void>;
  updateRecord: (active: boolean, egressId?: string, filePath?: string) => Promise<boolean>;
  setPermissionDevice: (device: Track.Source) => void;
  openApp: boolean;
  setOpenApp: (open: boolean) => void;
  toSettingGeneral: () => void;
  startOrStopAICutAnalysis: (
    freq: number,
    conf: AICutParticipantConf,
    reload?: boolean,
  ) => Promise<void>;
  openAIServiceAskNote: () => void;
  downloadAIMdReport?: () => Promise<void>;
  config: ReadableConf;
  SettingsComponent?: React.ComponentType;
  widgetState: WidgetState;
  waveAudioRef: React.RefObject<HTMLAudioElement>;
  promptSoundRef: React.RefObject<HTMLAudioElement>;
  waveAudioSrc: string;
  promptSoundSrc: string;
}

export function VideoConferenceStage({
  mainViewWidth,
  focusTrack,
  layoutContext,
  widgetUpdate,
  hasRoomLicense,
  toBuyRoomLicense,
  chatOpen,
  setChatOpen,
  space,
  settings,
  unifiedEntities,
  unifiedFocusEntity,
  unifiedPageSize,
  deviceType,
  isFullScreen,
  renderUnifiedEntity,
  sendFileConfirm,
  messageApi,
  controlsRef,
  setUserStatus,
  updateSettings,
  fetchSettings,
  updateRecord,
  setPermissionDevice,
  openApp,
  setOpenApp,
  toSettingGeneral,
  startOrStopAICutAnalysis,
  openAIServiceAskNote,
  downloadAIMdReport,
  config,
  SettingsComponent,
  widgetState,
  waveAudioRef,
  promptSoundRef,
  waveAudioSrc,
  promptSoundSrc,
  ...props
}: VideoConferenceStageProps) {
  return (
    <div
      className="lk-video-conference"
      {...props}
      style={{
        height: '100vh',
        transition: 'width 0.3s ease-in-out',
        width: mainViewWidth,
      }}
    >
      <LayoutContextProvider value={layoutContext} onWidgetChange={widgetUpdate}>
        <div
          className="lk-video-conference-inner"
          style={{
            flex: 1,
            alignItems: 'flex-start',
            height: '100dvh',
            gap: 8,
            flexDirection: 'column',
            paddingRight: 8,
          }}
        >
          {!hasRoomLicense && <LicenseAlert toBuyRoomLicense={toBuyRoomLicense}></LicenseAlert>}
          <div style={{ display: 'flex', flex: 1, width: '100%', minHeight: 0 }}>
            <div
              className={focusTrack ? 'lk-focus-layout-wrapper' : 'lk-grid-layout-wrapper'}
              style={{
                position: 'relative',
                flex: 1,
                minHeight: 0,
                height: '100%',
                width: chatOpen ? 'calc(100% - 308px)' : '100%',
                padding: '0px 0px 0px 8px',
                marginBottom: 0,
                transition: 'width 0.3s ease-in-out',
              }}
            >
              <UnifiedLayout
                entities={unifiedEntities}
                focusEntity={unifiedFocusEntity}
                layoutType={unifiedFocusEntity ? 'focus' : 'grid'}
                deviceType={deviceType}
                fullScreen={isFullScreen}
                pageSize={unifiedPageSize}
                preserveOffscreen
                className="lk-unified-layout-stage"
                style={{ width: '100%', height: '100%' }}
                renderEntity={renderUnifiedEntity}
                renderOverlay={({ currentPage, totalPages, nextPage, prevPage }) => {
                  if (totalPages <= 1) return null;

                  return (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 12,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 30,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <PaginationIndicator totalPageCount={totalPages} currentPage={currentPage} />
                      <PaginationControl
                        totalPageCount={totalPages}
                        currentPage={currentPage}
                        nextPage={nextPage}
                        prevPage={prevPage}
                      />
                    </div>
                  );
                }}
              />
            </div>
            {!isMobile() && chatOpen && (
              <div
                style={{
                  width: chatOpen ? 280 : 0,
                  height: '100%',
                  overflow: 'hidden',
                  transition: 'width 0.3s ease-in-out',
                  flexShrink: 0,
                  borderRadius: '0.5em',
                  marginLeft: 4,
                }}
              >
                <ChatPanel
                  space={space}
                  sendFileConfirm={sendFileConfirm}
                  messageApi={messageApi}
                  spaceInfo={settings}
                  onClose={() => setChatOpen(false)}
                />
              </div>
            )}
          </div>
          <Controls
            ref={controlsRef}
            setUserStatus={setUserStatus}
            controls={{ chat: true, settings: !!SettingsComponent }}
            updateSettings={updateSettings}
            spaceInfo={settings}
            fetchSettings={fetchSettings}
            updateRecord={updateRecord}
            setPermissionDevice={setPermissionDevice}
            openApp={openApp}
            setOpenApp={setOpenApp}
            toRenameSettings={toSettingGeneral}
            startOrStopAICutAnalysis={startOrStopAICutAnalysis}
            openAIServiceAskNote={openAIServiceAskNote}
            downloadAIMdReport={downloadAIMdReport}
            config={config}
          ></Controls>
        </div>
        {SettingsComponent && (
          <div
            className="lk-settings-menu-modal"
            style={{ display: widgetState.showSettings ? 'block' : 'none' }}
          >
            <SettingsComponent />
          </div>
        )}
        {isMobile() && chatOpen && (
          <EnhancedChat
            open={chatOpen}
            setOpen={setChatOpen}
            onClose={() => setChatOpen(false)}
            space={space}
            sendFileConfirm={sendFileConfirm}
            messageApi={messageApi}
            spaceInfo={settings}
          />
        )}
      </LayoutContextProvider>
      <RoomAudioRenderer />
      <ConnectionStateToast />
      <audio ref={waveAudioRef} style={{ display: 'none' }} src={waveAudioSrc}></audio>
      <audio ref={promptSoundRef} style={{ display: 'none' }} src={promptSoundSrc}></audio>
    </div>
  );
}
