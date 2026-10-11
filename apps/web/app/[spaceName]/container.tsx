'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
const SharedMeeting = dynamic(() => import('./components/sharedMeeting'), { ssr: false });
import { useConference } from '@/components/Layout/conference/hooks/useConference';
import { FlotLayout } from '@/components/Flot/layout';
import { ChatPanel } from '@/components/Chat';
import { Controls } from '@/components/Controller';
import { Channel } from '@/components/Channel';
import { LicenseAlert } from '@/components/Widgets/licenseAlert';
import { src } from '@/lib/std';
import phone from './components/phone.module.scss';
import { VideoContainerPC } from './components/pc';
import { PhoneRoomHeader, VideoContainerPhone } from './components/phone';
import { VideoContainerProps, VideoContainerExports } from '@/components/Layout/conference/types';
import {
  ConnectionStateToast,
  LayoutContextProvider,
  RoomAudioRenderer,
} from '@livekit/components-react';
import { FlotButton } from '@/components/Flot';

export const VideoContainer = React.forwardRef<VideoContainerExports, VideoContainerProps>(
  function VideoContainer(props, ref) {
    const model = useConference(props, ref);
    const searchParams = useSearchParams();
    const sharedUI = model.device === 'phone' && searchParams.get('meetingUi') === 'shared';
    const {
      SettingsComponent,
      messageApi,
      setPermissionDevice,
      config,
      props: conferenceProps,
      ref: conferenceRef,
      space,
      FlotLayoutRef,
      hasRoomLicense,
      toBuyRoomLicense,
      controlsRef,
      waveAudioRef,
      promptSoundRef,
      chatOpen,
      setChatOpen,
      sendFileConfirm,
      channelRef,
      settings,
      updateSettings,
      fetchSettings,
      updateRecord,
      showAI,
      showSideChannel,
      openApp,
      setOpenApp,
      isActive,
      showFlotApp,
      aiCutServiceRef,
      aiCutAnalysisRes,
      startOrStopAICutAnalysis,
      openAIServiceAskNote,
      reloadResult,
      widgetState,
      originTracks,
      tracks,
      widgetUpdate,
      layoutContext,
      toRenameSetting,
      toSettingGeneral,
      handleUpdateRoom,
      setUserStatus,
      showFlot,
      handleDragOver,
      handleDrop,
      handleDrag,
      mainViewWidth,
    } = model;
    const controls = (
      <Controls
        sharedUI={sharedUI}
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
        downloadAIMdReport={FlotLayoutRef.current?.downloadAIMdReport}
        config={config}
      ></Controls>
    );
    return (
      <div
        className={
          model.device === 'phone'
            ? `video_container_wrapper ${phone.room}`
            : 'video_container_wrapper'
        }
        style={{ position: 'relative' }}
        onDragEnter={handleDrag}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* 右侧应用浮窗，悬浮态 */}
        {model.device !== 'phone' &&
          showFlot &&
          space &&
          settings.participants[space.localParticipant.identity] && (
            <FlotButton
              openApp={openApp}
              setOpenApp={setOpenApp}
              style={{ position: 'absolute', top: '30px', right: '0px', zIndex: 1111 }}
            ></FlotButton>
          )}
        {space && settings.participants[space.localParticipant.identity] && (
          <FlotLayout
            showAI={showAI}
            ref={FlotLayoutRef}
            space={space.name}
            messageApi={messageApi}
            openApp={openApp}
            spaceInfo={settings}
            setOpenApp={setOpenApp}
            showAICutAnalysisSettings={controlsRef.current?.showAICutAnalysisSettings}
            reloadResult={reloadResult}
            aiCutAnalysisRes={aiCutAnalysisRes}
            startOrStopAICutAnalysis={startOrStopAICutAnalysis}
            openAIServiceAskNote={openAIServiceAskNote}
            cutInstance={aiCutServiceRef.current}
            updateSettings={updateSettings}
          ></FlotLayout>
        )}
        {/* 左侧侧边栏 */}
        {space && showSideChannel && (
          <Channel
            ref={channelRef}
            config={config}
            space={space}
            localParticipantId={space.localParticipant.identity}
            settings={settings}
            onUpdate={handleUpdateRoom}
            tracks={originTracks}
            messageApi={messageApi}
            isActive={isActive}
            updateSettings={updateSettings}
            toRenameSettings={toRenameSetting}
            toSettings={toSettingGeneral}
            setUserStatus={setUserStatus}
            showFlotApp={showFlotApp}
          ></Channel>
        )}
        {/* 主视口 */}
        <div
          className="lk-video-conference"
          {...conferenceProps}
          style={{
            height: '100dvh',
            transition: 'width 0.3s ease-in-out',
            width: model.device === 'phone' ? '100vw' : mainViewWidth,
          }}
        >
          {space && (
            <LayoutContextProvider
              value={layoutContext}
              // onPinChange={handleFocusStateChange}
              onWidgetChange={widgetUpdate}
            >
              <div
                className="lk-video-conference-inner"
                style={{
                  flex: 1,
                  alignItems: 'flex-start',
                  height: '100dvh',
                  gap: 8,
                  flexDirection: 'column',
                  paddingRight: model.device === 'phone' ? 0 : 8,
                }}
              >
                {model.device === 'phone' && !sharedUI && <PhoneRoomHeader model={model} />}
                {!hasRoomLicense && (
                  <LicenseAlert toBuyRoomLicense={toBuyRoomLicense}></LicenseAlert>
                )}
                <div style={{ display: 'flex', flex: 1, width: '100%', minHeight: 0 }}>
                  {sharedUI ? (
                    <SharedMeeting model={model} controls={controls} />
                  ) : model.device === 'phone' ? (
                    <VideoContainerPhone model={model} />
                  ) : (
                    <VideoContainerPC model={model} />
                  )}
                  {!sharedUI && chatOpen && space && (
                    <div
                      style={{
                        width: model.device === 'phone' ? 0 : 280,
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
                {!sharedUI && controls}
              </div>
              {SettingsComponent && (
                <div
                  className="lk-settings-menu-modal"
                  style={{ display: widgetState.showSettings ? 'block' : 'none' }}
                >
                  <SettingsComponent />
                </div>
              )}
            </LayoutContextProvider>
          )}
          <RoomAudioRenderer />
          <ConnectionStateToast />
          <audio
            ref={waveAudioRef}
            style={{ display: 'none' }}
            src={src('/audios/vocespacewave.m4a')}
          ></audio>
          <audio
            ref={promptSoundRef}
            style={{ display: 'none' }}
            src={src('/audios/prompt.mp3')}
          ></audio>
        </div>
      </div>
    );
  },
);
