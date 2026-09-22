import { DEFAULT_DRAWER_PROP, DrawerCloser } from '@/app/pages/controls/drawer_tools';
import { Settings } from '@/app/pages/controls/settings/settings';
import { AICutAnalysisSettingsPanel } from '@/app/pages/controls/widgets/ai';
import { WorkModal } from '@/app/pages/controls/widgets/work';
import { ParticipantManage } from '@/app/pages/participant/manage';
import mobile from '@/styles/mobile.module.scss';
import styles from '@/styles/controls.module.scss';
import { Drawer, Input, Modal } from 'antd';
import type { useControls } from '../hooks/useControls';
import { ControlsPC } from './pc';
import { ControlsPhone } from './phone';
export type ControlsModel = ReturnType<typeof useControls>;
export function ControlsSurface({ model }: { model: ControlsModel }) {
  const {
    updateSettings,
    spaceInfo,
    toRenameSettings,
    ref,
    t,
    inviteTextRef,
    aiCutModalOpen,
    aiCutServiceRef,
    messageApi,
    contextHolder,
    noteHolder,
    userChoices,
    space,
    showAI,
    openMore,
    setOpenMore,
    openShareModal,
    setOpenShareModal,
    selectedParticipant,
    setSelectedParticipant,
    username,
    setUsername,
    openNameModal,
    setOpenNameModal,
    participantList,
    isManager,
    settingVis,
    setSettingVis,
    key,
    setKey,
    settingsRef,
    closeSetting,
    openRecordModal,
    isDownload,
    recordModalOnOk,
    recordModalOnCancel,
    aiCutDeps,
    setAICutDeps,
    extraction,
    setExtraction,
    cutFreq,
    setCutFreq,
    cutBlur,
    setCutBlur,
    isServiceOpen,
    setIsServiceOpen,
    aiCutOptions,
    aiCutOptionsChange,
    saveAICutServiceSettings,
    workModalOpen,
    setWorkModalOpen,
    workEnabled,
    setWorkEnabled,
    isUseAI,
    setIsUseAI,
    isSync,
    setIsSync,
    videoBlur,
    setVideoBlur,
    screenBlur,
    setScreenBlur,
    handleWorkMode,
    device,
  } = model;
  return <>{contextHolder}{noteHolder}{device === 'phone' ? <ControlsPhone model={model} /> : <ControlsPC model={model} />}<Drawer
    {...DEFAULT_DRAWER_PROP}
    title={t('common.setting')}
    width={device === 'phone' ? '100%' : 640}
    rootClassName={device === 'phone' ? mobile.drawer : undefined}
    styles={{ body: { padding: device === 'phone' ? 0 : '0 24px', overflow: 'auto' } }}
    open={settingVis}
    onClose={() => {
      setSettingVis(false);
      closeSetting();
    }}
    extra={DrawerCloser({
      on_clicked: () => {
        setSettingVis(false);
        closeSetting();
      },
    })}
  >
    <div className={styles.setting_container}>
      {space && (
        <Settings
          showAI={showAI}
          updateSettings={updateSettings}
          ref={settingsRef}
          close={settingVis}
          messageApi={messageApi}
          space={space}
          username={userChoices.username}
          tab={{ key, setKey }}
          localParticipant={space.localParticipant}
          spaceInfo={spaceInfo}
        ></Settings>
      )}
    </div>
  </Drawer>
    <ParticipantManage
      open={openMore}
      setOpen={setOpenMore}
      space={space}
      participantList={participantList}
      setOpenShareModal={setOpenShareModal}
      spaceInfo={spaceInfo}
      selectedParticipant={selectedParticipant}
      setSelectedParticipant={setSelectedParticipant}
      setOpenNameModal={setOpenNameModal}
      setUsername={setUsername}
      updateSettings={updateSettings}
      toRenameSettings={toRenameSettings}
      messageApi={messageApi}
    ></ParticipantManage>
    {/* ------------- share space modal -------------------------------------------------------- */}
    <Modal
      open={openShareModal}
      onCancel={() => setOpenShareModal(false)}
      title={t('more.participant.invite.title')}
      okText={t('more.participant.invite.ok')}
      cancelText={t('more.participant.invite.cancel')}
      onOk={model.copyInvite}
    >
      <div className={styles.invite_container} ref={inviteTextRef}>
        <div className={styles.invite_container_item}>
          {t('more.participant.invite.texts.0')
            .replace('$user', space?.localParticipant.name || '')
            .replace('$space', space?.name || '')}
        </div>
        <div className={styles.invite_container_item}>
          <div className={styles.invite_container_item_justify}>
            {t('more.participant.invite.texts.1').replace('$space', space?.name || '')}
          </div>
          <div>
            {t('more.participant.invite.link')}: {model.inviteUrl}
          </div>
        </div>
      </div>
    </Modal>
    {/* -------------- control participant name modal ---------------------------------------- */}
    <Modal
      open={openNameModal}
      title={t('more.participant.set.control.change_name')}
      okText={t('common.confirm')}
      cancelText={t('common.cancel')}
      onCancel={() => {
        setOpenNameModal(false);
      }}
      onOk={model.changeParticipantName}
    >
      <Input
        placeholder={t('settings.general.username')}
        value={username}
        onChange={(e) => {
          setUsername(e.target.value);
        }}
      ></Input>
    </Modal>
    {/* ---------------- record modal ------------------------------------------------------- */}
    <Modal
      open={openRecordModal}
      title={isDownload ? t('more.record.download') : t('more.record.title')}
      okText={
        isDownload
          ? t('more.record.to_download')
          : isManager
            ? t('more.record.confirm')
            : t('more.record.confirm_request')
      }
      cancelText={t('more.record.cancel')}
      onCancel={recordModalOnCancel}
      onOk={recordModalOnOk}
    >
      {isDownload ? (
        <div>{t('more.record.download_msg')}</div>
      ) : (
        <div>{isManager ? t('more.record.desc') : t('more.record.request')}</div>
      )}
    </Modal>
    {/* -------------------- ai cut modal --------------------------------------------------- */}
    {showAI && (
      <Modal
        open={aiCutModalOpen}
        title={t('ai.cut.title')}
        footer={null}
        okText={aiCutServiceRef.current.isRunning ? t('common.close') : t('common.open')}
        cancelText={t('common.cancel')}
        onCancel={saveAICutServiceSettings}
      >
        <AICutAnalysisSettingsPanel
          space={space}
          spaceInfo={spaceInfo}
          aiCutDeps={aiCutDeps}
          setAICutDeps={setAICutDeps}
          extraction={extraction}
          setExtraction={setExtraction}
          cutFreq={cutFreq}
          setCutFreq={setCutFreq}
          cutBlur={cutBlur}
          setCutBlur={setCutBlur}
          isServiceOpen={isServiceOpen}
          setIsServiceOpen={setIsServiceOpen}
          aiCutOptions={aiCutOptions}
          aiCutOptionsChange={aiCutOptionsChange}
          isManager={isManager}
        ></AICutAnalysisSettingsPanel>
        {/* <Button onClick={checkMyAICutAnalysis}>{t('ai.cut.myAnalysis')}</Button> */}
      </Modal>
    )}
    {/* ------------------ work ----------------------------------------------------- */}
    {space && showAI && (
      <WorkModal
        space={space}
        spaceInfo={spaceInfo}
        open={workModalOpen}
        setOpen={setWorkModalOpen}
        isStartWork={workEnabled}
        setIsStartWork={setWorkEnabled}
        isUseAI={isUseAI}
        setIsUseAI={setIsUseAI}
        isSync={isSync}
        setIsSync={setIsSync}
        videoBlur={videoBlur}
        setVideoBlur={setVideoBlur}
        screenBlur={screenBlur}
        setScreenBlur={setScreenBlur}
        handleWorkMode={handleWorkMode}
        updateSettings={updateSettings}
      ></WorkModal>
    )}</>;
}
