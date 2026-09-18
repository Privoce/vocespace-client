'use client';

import {
  ActiveSpacesSection,
  CreateSpaceStrategyModal,
  DashboardActions,
  DashboardDrive,
  DashboardLicense,
  DashboardLicenseManage,
  DashboardLog,
  DashboardRecording,
  DashboardStats,
  FlushDbModal,
  GlobalConfModal,
  HistorySpacesSection,
  HistoryStats,
  HyperbeamConfModal,
  LeaderboardSection,
  ManageSpacesModal,
  SMTPConfModal,
} from '@/app/dashboard/components';
import { LangSelect } from '@/app/pages/controls/selects/lang_select';
import { Title } from '@/features/dashboard/shared';
import styles from '@/styles/dashboard.module.scss';
import type { useDashboard } from '../hooks/useDashboard';
export type DashboardModel = ReturnType<typeof useDashboard>;
export function DashboardSurface({ model }: { model: DashboardModel }) {
  const {
    t,
    menuTab,
    setMenuTab,
    pageSize1,
    setPageSize1,
    pageSize2,
    setPageSize2,
    historySpacesData,
    dailyLeaderboard,
    weeklyLeaderboard,
    monthlyLeaderboard,
    loading,
    totalSpaces,
    totalParticipants,
    onlineParticipants,
    authParticipants,
    historyTotalRooms,
    historyTotalUsers,
    historyPlatformUsers,
    historyAvgDuration,
    messageApi,
    contextHolder,
    openConf,
    setOpenConf,
    createSpaceConf,
    setCreateSpaceConf,
    smtpConfOpen,
    setSMTPConfOpen,
    hyperbeamConfOpen,
    setHyperbeamConfOpen,
    isHostManager,
    setIsHostManager,
    hostToken,
    setHostToken,
    openManage,
    manageLoading,
    manageSpaces,
    editingOwnerSpace,
    setEditingOwnerSpace,
    ownerCandidates,
    selectedNewOwner,
    setSelectedNewOwner,
    conf,
    createSpaceOption,
    setCreateSpaceOption,
    smtpConf,
    setSMTPConf,
    hyperbeamConf,
    setHyperbeamConf,
    addWhiteListValue,
    setAddWhiteListValue,
    selectOption,
    setSelectOption,
    flushDbConfirm,
    setFlushDbConfirm,
    manageSearchText,
    setManageSearchText,
    createSpaceWhiteList,
    setCreateSpaceWhiteList,
    initializingConf,
    clearVerified,
    groupedSpacesData,
    fetchAllData,
    handleVerifyHostAndLoad,
    handleCloseManage,
    handleDeleteSpace,
    handleEditOwner,
    handleSaveNewOwner,
    handleExportSpace,
    confirmConfHandle,
    confirmCreateSpaceHandle,
    confirmSMTPConfHandle,
    confirmHyperbeamConfHandle,
    handleSetupConf,
    handleProceed,
  } = model;
  return (
    <div className={model.device === 'phone' ? `${mobile.surface} ${phone.container}` : styles.container} style={{ position: 'relative' }}>
      {contextHolder}
      {model.device === 'phone' ? <DashboardPhone model={model} /> : <DashboardPC model={model} />}
      <main className={model.device === 'phone' ? phone.main : styles.main}>
        <div style={{ position: model.device === 'phone' ? 'static' : 'absolute', right: 24, top: 16, zIndex: 10, textAlign: 'right' }}>
          <LangSelect></LangSelect>
        </div>
        <div style={{ marginBottom: 16 }}>
          <Title level={2}>{t('dashboard.title')}</Title>
          {menuTab === 'history' ? (
            <HistoryStats
              totalRooms={historyTotalRooms}
              totalUsers={historyTotalUsers}
              platformUsers={historyPlatformUsers}
              avgDuration={historyAvgDuration}
            />
          ) : menuTab === 'licenseManage' || menuTab === 'drive' ? null : menuTab !== 'license' && (model.device === 'pc' || menuTab === 'home') ? (
            <DashboardStats
              totalSpaces={totalSpaces}
              totalParticipants={totalParticipants}
              onlineParticipants={onlineParticipants}
              authParticipants={authParticipants}
              action={
                <DashboardActions
                  selectOption={selectOption}
                  loading={loading}
                  onOptionChange={(v) => setSelectOption(v)}
                  onProceed={handleProceed}
                />
              }
            />
          ) : null}
        </div>

        {menuTab === 'drive' && (
          <DashboardDrive
            onSubmit={handleSetupConf}
            loading={initializingConf}
            conf={conf}
            initialized={conf?.initialized}
            onCancel={() => setMenuTab('home')}
          />
        )}

        {menuTab === 'home' && (
          <ActiveSpacesSection
            groupedSpacesData={groupedSpacesData}
            loading={loading}
            pageSize={pageSize1}
            onPageSizeChange={setPageSize1}
          />
        )}
        {menuTab === 'history' && (
          <>
            <HistorySpacesSection
              historySpacesData={historySpacesData}
              loading={loading}
              pageSize={pageSize2}
              onPageSizeChange={setPageSize2}
            />

            <LeaderboardSection
              dailyLeaderboard={dailyLeaderboard}
              weeklyLeaderboard={weeklyLeaderboard}
              monthlyLeaderboard={monthlyLeaderboard}
              loading={loading}
            />
          </>
        )}

        {menuTab === 'log' && <DashboardLog title={t('dashboard.log.title')}></DashboardLog>}

        {menuTab === 'recording' && <DashboardRecording />}

        {menuTab === 'license' && <DashboardLicense messageApi={messageApi} />}

        {menuTab === 'licenseManage' && <DashboardLicenseManage />}

        <GlobalConfModal
          open={openConf}
          isHostManager={isHostManager}
          hostToken={hostToken}
          onTokenChange={setHostToken}
          onCancel={() => setOpenConf(false)}
          onConfirm={confirmConfHandle}
          onReload={() => {
            setHostToken('');
            setOpenConf(false);
            setIsHostManager(false);
            messageApi.success(t('dashboard.conf.success.update'));
          }}
          messageApi={messageApi}
        />

        <ManageSpacesModal
          open={openManage}
          isHostManager={isHostManager}
          hostToken={hostToken}
          manageLoading={manageLoading}
          manageSpaces={manageSpaces}
          manageSearchText={manageSearchText}
          editingOwnerSpace={editingOwnerSpace}
          ownerCandidates={ownerCandidates}
          selectedNewOwner={selectedNewOwner}
          onTokenChange={setHostToken}
          onSearchTextChange={setManageSearchText}
          onVerifyAndLoad={handleVerifyHostAndLoad}
          onClose={handleCloseManage}
          onLogout={() => {
            setIsHostManager(false);
            setHostToken('');
            clearVerified();
          }}
          onDeleteSpace={handleDeleteSpace}
          onEditOwner={handleEditOwner}
          onExportSpace={handleExportSpace}
          onSaveNewOwner={handleSaveNewOwner}
          onSelectedNewOwnerChange={setSelectedNewOwner}
          onEditingOwnerSpaceChange={setEditingOwnerSpace}
        />

        <CreateSpaceStrategyModal
          open={createSpaceConf}
          isHostManager={isHostManager}
          hostToken={hostToken}
          createSpaceOption={createSpaceOption}
          createSpaceWhiteList={createSpaceWhiteList}
          addWhiteListValue={addWhiteListValue}
          onTokenChange={setHostToken}
          onOptionChange={setCreateSpaceOption}
          onWhiteListChange={setCreateSpaceWhiteList}
          onAddWhiteListValueChange={setAddWhiteListValue}
          onCancel={() => setCreateSpaceConf(false)}
          onConfirm={confirmCreateSpaceHandle}
        />

        <SMTPConfModal
          open={smtpConfOpen}
          isHostManager={isHostManager}
          hostToken={hostToken}
          smtpConf={smtpConf}
          onTokenChange={setHostToken}
          onSMTPConfChange={setSMTPConf}
          onCancel={() => setSMTPConfOpen(false)}
          onConfirm={confirmSMTPConfHandle}
        />

        <HyperbeamConfModal
          open={hyperbeamConfOpen}
          isHostManager={isHostManager}
          hostToken={hostToken}
          hyperbeamConf={hyperbeamConf}
          onTokenChange={setHostToken}
          onHyperbeamConfChange={setHyperbeamConf}
          onCancel={() => setHyperbeamConfOpen(false)}
          onConfirm={confirmHyperbeamConfHandle}
        />

        <FlushDbModal
          open={flushDbConfirm}
          hostToken={hostToken}
          onTokenChange={setHostToken}
          onCancel={() => setFlushDbConfirm(false)}
          onFlushSuccess={fetchAllData}
          messageApi={messageApi}
        />
      </main>
    </div>
  );
}

import mobile from '@/features/shared/mobile.module.scss';
import { DashboardPC } from './pc';
import { DashboardPhone } from './phone';
import phone from './phone.module.scss';
