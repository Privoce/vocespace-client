'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Menu, MenuProps, Typography, message } from 'antd';
import styles from '@/styles/dashboard.module.scss';
import { api } from '@/lib/api';
import { useVoceSpaceConf } from '../pages/controls/settings/conf';
import { ParticipantSettings, SpaceDateRecords, SpaceInfo, SpaceInfoMap } from '@/lib/std/space';
import { useI18n } from '@/lib/i18n/i18n';
import { LangSelect } from '../pages/controls/selects/lang_select';
import { usePlatformUserInfoCheap } from '@/lib/hooks/platform';
import { socket } from '../[spaceName]/PageClientImpl';
import { WsBase } from '@/lib/std/device';
import { CreateSpaceStrategy } from '@/lib/std/conf';
import {
  DashboardStats,
  DashboardActions,
  ActiveSpacesSection,
  HistorySpacesSection,
  LeaderboardSection,
  GlobalConfModal,
  ManageSpacesModal,
  CreateSpaceStrategyModal,
  FlushDbModal,
  DashboardLog,
  DashboardRecording,
} from './components';

const { Title } = Typography;

interface LeaderboardData {
  key: string;
  participantName: string;
  spaceId: string;
  totalDuration: number;
  periodDuration: number;
  totalDisplay: string;
  periodDisplay: string;
}

interface HistorySpaceData {
  key: string;
  room: string;
  during: string;
  today: string;
}

interface ParticipantTableData {
  key: string;
  spaceId: string;
  participantId: string;
  name: string;
  volume: number;
  blur: number;
  screenBlur: number;
  status: boolean;
  isOwner: boolean;
  isRecording: boolean;
  virtualEnabled: boolean;
  during: string;
  online: boolean;
  isAuth: boolean;
}

type ActionKey = 'refresh' | 'global_conf' | 'manage_spaces' | 'ac_space' | 'flushdb';

export default function Dashboard() {
  const { t } = useI18n();
  const [menuTab, setMenuTab] = useState('home');
  const [pageSize1, setPageSize1] = useState(10);
  const [pageSize2, setPageSize2] = useState(10);
  const [currentSpacesData, setCurrentSpacesData] = useState<ParticipantTableData[]>([]);
  const [historySpacesData, setHistorySpacesData] = useState<HistorySpaceData[]>([]);
  const [dailyLeaderboard, setDailyLeaderboard] = useState<{
    [spaceId: string]: LeaderboardData[];
  }>({});
  const [weeklyLeaderboard, setWeeklyLeaderboard] = useState<{
    [spaceId: string]: LeaderboardData[];
  }>({});
  const [monthlyLeaderboard, setMonthlyLeaderboard] = useState<{
    [spaceId: string]: LeaderboardData[];
  }>({});
  const [loading, setLoading] = useState(false);
  const [totalSpaces, setTotalSpaces] = useState(0);
  const [totalParticipants, setTotalParticipants] = useState(0);
  const [onlineParticipants, setOnlineParticipants] = useState(0);
  const [authParticipants, setAuthParticipants] = useState(0);
  const [activeRecordings, setActiveRecordings] = useState(0);
  const [messageApi, contextHolder] = message.useMessage();
  const [openConf, setOpenConf] = useState(false);
  const [createSpaceConf, setCreateSpaceConf] = useState(false);
  const [isHostManager, setIsHostManager] = useState(false);
  const [hostToken, setHostToken] = useState('');
  const [openManage, setOpenManage] = useState(false);
  const [manageLoading, setManageLoading] = useState(false);
  const [manageSpaces, setManageSpaces] = useState<SpaceInfoMap | null>(null);
  const [editingOwnerSpace, setEditingOwnerSpace] = useState<string | null>(null);
  const [ownerCandidates, setOwnerCandidates] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedNewOwner, setSelectedNewOwner] = useState<string | null>(null);
  const { conf, getConf, checkHostToken, updateCreateSpaceConf } = useVoceSpaceConf();
  const [createSpaceOption, setCreateSpaceOption] = useState<CreateSpaceStrategy>(
    conf?.create_space || 'all',
  );
  const [addWhiteListValue, setAddWhiteListValue] = useState<string>('');
  const [selectOption, setSelectOption] = useState<ActionKey>('refresh');
  const [flushDbConfirm, setFlushDbConfirm] = useState(false);
  const [manageSearchText, setManageSearchText] = useState('');
  const [createSpaceWhiteList, setCreateSpaceWhiteList] = useState<string>('');
  const VERIFIED_KEY = 'vocespace_host_token_verified';

  useEffect(() => {
    if (conf) {
      setCreateSpaceOption(conf?.create_space || 'all');
      if (conf.whiteList && conf.whiteList.length > 0) {
        setCreateSpaceWhiteList(conf.whiteList.join('\n'));
      }
    }
  }, [conf]);

  const getVerified = () => {
    try {
      const v = localStorage.getItem(VERIFIED_KEY);
      if (!v) return null;
      return JSON.parse(v) as { token: string; at: number } | null;
    } catch (e) {
      return null;
    }
  };

  const setVerified = (token: string) => {
    try {
      localStorage.setItem(VERIFIED_KEY, JSON.stringify({ token, at: Date.now() }));
    } catch (e) {
      // ignore
    }
  };

  const clearVerified = () => {
    try {
      localStorage.removeItem(VERIFIED_KEY);
    } catch (e) {
      // ignore
    }
  };

  const groupedSpacesData = useMemo(() => {
    const grouped: { [spaceId: string]: ParticipantTableData[] } = {};
    currentSpacesData.forEach((participant) => {
      if (!grouped[participant.spaceId]) {
        grouped[participant.spaceId] = [];
      }
      if (participant.online) {
        grouped[participant.spaceId].push(participant);
      }
    });
    return grouped;
  }, [currentSpacesData]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [spaceResponse, historyResponse] = await Promise.all([
        api.allSpaceInfos(),
        api.historySpaceInfos(),
      ]);

      let records: SpaceDateRecords | null = null;
      if (historyResponse.ok) {
        const result = await historyResponse.json();
        records = result.records;
      } else {
        messageApi.error(t('dashboard.history_fetch_failed'));
      }

      const historicalDurations: { [spaceId: string]: { [name: string]: number } } = {};

      if (records) {
        Object.entries(records).forEach(([spaceId, timeRecords]) => {
          historicalDurations[spaceId] = {};
          Object.entries(timeRecords.participants).forEach(
            ([participantName, participantRecords]) => {
              let totalDuration = 0;
              participantRecords.forEach((record) => {
                const end = record.end || Date.now();
                totalDuration += end - record.start;
              });
              historicalDurations[spaceId][participantName] = totalDuration;
            },
          );
        });

        processHistoryData(records);
      }

      if (spaceResponse.ok) {
        const spaceInfoMap: SpaceInfoMap = await spaceResponse.json();

        const participantsData: ParticipantTableData[] = [];
        let roomCount = 0;
        let participantCount = 0;
        let recordingCount = 0;
        let onlineCount = 0;
        let unAuthCount = 0;
        Object.entries(spaceInfoMap).forEach(([spaceId, spaceInfo]: [string, SpaceInfo]) => {
          if (spaceInfo.participants && Object.keys(spaceInfo.participants).length > 0) {
            roomCount++;
            if (spaceInfo.record?.active) {
              recordingCount++;
            }

            Object.entries(spaceInfo.participants).forEach(
              ([participantId, participant]: [string, ParticipantSettings]) => {
                participantCount++;
                if (participant.online) {
                  onlineCount++;
                }

                if (
                  !participant.auth ||
                  participant.auth?.identity === 'guest' ||
                  participant.auth?.platform === 'other'
                ) {
                  unAuthCount++;
                }

                const historicalDuration = historicalDurations[spaceId]?.[participant.name] || 0;
                const hours = Math.floor(historicalDuration / 3600000);
                const minutes = Math.floor((historicalDuration % 3600000) / 60000);
                const duringDisplay = `${hours}h ${minutes}m`;

                participantsData.push({
                  key: `${spaceId}-${participantId}`,
                  spaceId,
                  participantId,
                  name: participant.name,
                  volume: participant.volume,
                  blur: participant.blur,
                  screenBlur: participant.screenBlur,
                  status: participant.online,
                  isOwner: spaceInfo.ownerId === participantId,
                  isRecording: spaceInfo.record?.active || false,
                  virtualEnabled: participant.virtual?.enabled || false,
                  during: duringDisplay,
                  online: participant.online,
                  isAuth: usePlatformUserInfoCheap({ user: participant }).isAuth,
                });
              },
            );
          }
        });

        setCurrentSpacesData(participantsData);
        setTotalSpaces(roomCount);
        setTotalParticipants(participantCount);
        setOnlineParticipants(onlineCount);
        setAuthParticipants(
          participantCount - unAuthCount >= 0 ? participantCount - unAuthCount : 0,
        );
        setActiveRecordings(recordingCount);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const processHistoryData = (records: SpaceDateRecords) => {
    const historyData: HistorySpaceData[] = [];
    const dailyData: { [spaceId: string]: LeaderboardData[] } = {};
    const weeklyData: { [spaceId: string]: LeaderboardData[] } = {};
    const monthlyData: { [spaceId: string]: LeaderboardData[] } = {};

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayEnd = todayStart + 24 * 60 * 60 * 1000 - 1;

    const weekStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - now.getDay(),
    ).getTime();
    const weekEnd = weekStart + 7 * 24 * 60 * 60 * 1000 - 1;

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime();

    for (const [spaceId, timeRecords] of Object.entries(records)) {
      let totalSpaceDuration = 0;
      let todaySpaceDuration = 0;

      timeRecords.space.forEach((record) => {
        const end = record.end || Date.now();
        totalSpaceDuration += end - record.start;

        if (record.start >= todayStart && record.start <= todayEnd) {
          if (end > todayEnd) {
            todaySpaceDuration += todayEnd - record.start;
          } else {
            todaySpaceDuration += end - record.start;
          }
        }
      });

      historyData.push({
        key: spaceId,
        room: spaceId,
        during: `${Math.floor(totalSpaceDuration / 3600000)}h ${Math.floor(
          (totalSpaceDuration % 3600000) / 60000,
        )}m`,
        today: `${Math.floor(todaySpaceDuration / 3600000)}h ${Math.floor(
          (todaySpaceDuration % 3600000) / 60000,
        )}m`,
      });

      const dailyParticipants: { [name: string]: { total: number; period: number } } = {};
      const weeklyParticipants: { [name: string]: { total: number; period: number } } = {};
      const monthlyParticipants: { [name: string]: { total: number; period: number } } = {};

      Object.entries(timeRecords.participants).forEach(([participantName, records]) => {
        let totalDuration = 0;
        let dailyDuration = 0;
        let weeklyDuration = 0;
        let monthlyDuration = 0;

        records.forEach((record) => {
          const end = record.end || Date.now();
          const duration = end - record.start;
          totalDuration += duration;

          const recordEnd = Math.min(end, todayEnd);
          const recordStart = Math.max(record.start, todayStart);
          if (recordStart <= todayEnd && recordEnd >= todayStart) {
            dailyDuration += Math.max(0, recordEnd - recordStart);
          }

          const weekRecordEnd = Math.min(end, weekEnd);
          const weekRecordStart = Math.max(record.start, weekStart);
          if (weekRecordStart <= weekEnd && weekRecordEnd >= weekStart) {
            weeklyDuration += Math.max(0, weekRecordEnd - weekRecordStart);
          }

          const monthRecordEnd = Math.min(end, monthEnd);
          const monthRecordStart = Math.max(record.start, monthStart);
          if (monthRecordStart <= monthEnd && monthRecordEnd >= monthStart) {
            monthlyDuration += Math.max(0, monthRecordEnd - monthRecordStart);
          }
        });

        if (totalDuration > 0) {
          dailyParticipants[participantName] = { total: totalDuration, period: dailyDuration };
          weeklyParticipants[participantName] = {
            total: totalDuration,
            period: weeklyDuration,
          };
          monthlyParticipants[participantName] = {
            total: totalDuration,
            period: monthlyDuration,
          };
        }
      });

      const formatDuration = (ms: number) => {
        const hours = Math.floor(ms / 3600000);
        const minutes = Math.floor((ms % 3600000) / 60000);
        const second = Math.floor((ms % 60000) / 1000);
        return `${hours}h ${minutes}m ${second}s`;
      };

      dailyData[spaceId] = Object.entries(dailyParticipants)
        .map(([name, data]) => ({
          key: `${spaceId}-${name}-daily`,
          participantName: name,
          spaceId,
          totalDuration: data.total,
          periodDuration: data.period,
          totalDisplay: formatDuration(data.total),
          periodDisplay: formatDuration(data.period),
        }))
        .sort((a, b) => b.periodDuration - a.periodDuration);

      weeklyData[spaceId] = Object.entries(weeklyParticipants)
        .map(([name, data]) => ({
          key: `${spaceId}-${name}-weekly`,
          participantName: name,
          spaceId,
          totalDuration: data.total,
          periodDuration: data.period,
          totalDisplay: formatDuration(data.total),
          periodDisplay: formatDuration(data.period),
        }))
        .sort((a, b) => b.periodDuration - a.periodDuration);

      monthlyData[spaceId] = Object.entries(monthlyParticipants)
        .map(([name, data]) => ({
          key: `${spaceId}-${name}-monthly`,
          participantName: name,
          spaceId,
          totalDuration: data.total,
          periodDuration: data.period,
          totalDisplay: formatDuration(data.total),
          periodDisplay: formatDuration(data.period),
        }))
        .sort((a, b) => b.periodDuration - a.periodDuration);
    }

    setHistorySpacesData(historyData);
    setDailyLeaderboard(dailyData);
    setWeeklyLeaderboard(weeklyData);
    setMonthlyLeaderboard(monthlyData);
  };

  useEffect(() => {
    getConf();
    fetchAllData();

    const interval = setInterval(() => {
      fetchAllData();
    }, 120000);

    return () => clearInterval(interval);
  }, []);

  const handleVerifyHostAndLoad = async (tokenOverride?: string) => {
    try {
      setManageLoading(true);
      const token = tokenOverride ?? hostToken;

      const saved = getVerified();
      if (saved && saved.token === token && Date.now() - saved.at < 3600_000) {
        setHostToken(token);
        setIsHostManager(true);
        const resp = await api.allSpaceInfos();
        if (!resp.ok) {
          messageApi.error(t('dashboard.spaces_fetch_failed'));
          return;
        }
        const spaces: SpaceInfoMap = await resp.json();
        setManageSpaces(spaces);
        return;
      }

      const ok = await checkHostToken(token);
      if (!ok) {
        messageApi.error(t('dashboard.host_token_verify_failed'));
        return;
      }
      setVerified(token);
      setHostToken(token);
      setIsHostManager(true);
      const resp = await api.allSpaceInfos();
      if (!resp.ok) {
        messageApi.error(t('dashboard.spaces_fetch_failed'));
        return;
      }
      const spaces: SpaceInfoMap = await resp.json();
      setManageSpaces(spaces);
    } catch (e) {
      console.error(e);
      messageApi.error(t('dashboard.verify_or_load_failed'));
    } finally {
      setManageLoading(false);
    }
  };

  const handleCloseManage = () => {
    setOpenManage(false);
    setIsHostManager(false);
    setHostToken('');
    setManageSpaces(null);
  };

  const handleDeleteSpace = async (spaceName: string) => {
    try {
      setManageLoading(true);
      const resp = await api.deleteSpace(spaceName);
      if (!resp.ok) {
        messageApi.error(t('dashboard.delete_failed'));
      } else {
        messageApi.success(t('dashboard.delete_success'));
        const refreshed = await api.allSpaceInfos();
        if (refreshed.ok) {
          const spaces: SpaceInfoMap = await refreshed.json();
          setManageSpaces(spaces);
          await fetchAllData();
        }
      }
    } catch (e) {
      console.error(e);
      messageApi.error(t('dashboard.delete_failed'));
    } finally {
      setManageLoading(false);
    }
  };

  const handleEditOwner = async (spaceName: string) => {
    try {
      setEditingOwnerSpace(spaceName);
      setSelectedNewOwner(null);
      setManageLoading(true);
      const resp = await api.getSpaceInfo(spaceName);

      if (!resp.ok) {
        messageApi.error(t('dashboard.get_space_info_failed'));
        return;
      }
      const { settings: data } = await resp.json();
      const participants = data as SpaceInfo;
      const candidates: Array<{ id: string; name: string }> = Object.entries(
        participants.participants || {},
      ).map(([id, p]: [string, ParticipantSettings]) => ({ id, name: p.name }));
      console.warn(data, candidates);
      setOwnerCandidates(candidates);
    } catch (e) {
      console.error(e);
      messageApi.error(t('dashboard.get_candidates_failed'));
    } finally {
      setManageLoading(false);
    }
  };

  const handleSaveNewOwner = async () => {
    if (!editingOwnerSpace || !selectedNewOwner) {
      messageApi.error(t('dashboard.select_new_owner'));
      return;
    }
    try {
      setManageLoading(true);
      const resp = await api.updateOwnerId(editingOwnerSpace, selectedNewOwner);
      if (!resp.ok) {
        messageApi.error(t('dashboard.change_owner_failed'));
      } else {
        messageApi.success(t('dashboard.change_owner_success'));
        const refreshed = await api.allSpaceInfos();
        if (refreshed.ok) {
          const spaces: SpaceInfoMap = await refreshed.json();
          setManageSpaces(spaces);
          await fetchAllData();
        }
        setEditingOwnerSpace(null);
        setSelectedNewOwner(null);
        socket.emit('update_user_status', {
          space: editingOwnerSpace,
        } as WsBase);
      }
    } catch (e) {
      console.error(e);
      messageApi.error(t('dashboard.change_owner_failed'));
    } finally {
      setManageLoading(false);
    }
  };

  const handleExportSpace = async (spaceName: string) => {
    try {
      setManageLoading(true);
      const [spaceResp, historyResp] = await Promise.all([
        api.getSpaceInfo(spaceName),
        api.historySpaceInfos(),
      ]);
      if (!spaceResp.ok) {
        messageApi.error(t('dashboard.get_space_info_failed'));
        return;
      }
      const spaceInfo: SpaceInfo = await spaceResp.json();
      let records: SpaceDateRecords | null = null;
      if (historyResp.ok) {
        const r = await historyResp.json();
        records = r.records;
      }

      let md = `- ${t('dashboard.export.space_label')}: ${spaceName}\n`;
      md += `- ${t('dashboard.export.children_label')}:\n`;
      if (spaceInfo.children && spaceInfo.children.length > 0) {
        for (const child of spaceInfo.children) {
          const users = child.participants.join(', ');
          md += `    - ${child.name}: ${users}\n`;
        }
      } else {
        md += `    - ${t('dashboard.export.none')}\n`;
      }

      md += `- ${t('dashboard.export.users_label')}:\n`;
      if (records && records[spaceName]) {
        const participants = records[spaceName].participants || {};
        for (const [pname, precords] of Object.entries(participants)) {
          const durations = precords
            .map((r: any) => {
              const end = r.end || Date.now();
              return `${new Date(r.start).toLocaleString()} - ${new Date(end).toLocaleString()}`;
            })
            .join('; ');
          md += `    - ${pname}: ${durations}\n`;
        }
      } else if (spaceInfo.participants) {
        for (const [id, p] of Object.entries(spaceInfo.participants)) {
          md += `    - ${p.name} (id: ${id})\n`;
        }
      }

      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${spaceName}.md`;
      a.click();
      URL.revokeObjectURL(url);
      messageApi.success(t('dashboard.export_success'));
    } catch (e) {
      console.error(e);
      messageApi.error(t('dashboard.export_failed'));
    } finally {
      setManageLoading(false);
    }
  };

  const confirmConfHandle = async () => {
    if (!isHostManager) {
      const saved = getVerified();
      if (saved && saved.token === hostToken && Date.now() - saved.at < 3600_000) {
        setIsHostManager(true);
        return;
      }
      const success = await checkHostToken(hostToken);
      if (success) {
        setVerified(hostToken);
        setIsHostManager(true);
      } else {
        messageApi.error(t('dashboard.conf.error.verify'));
      }
    } else {
      setOpenConf(false);
      setIsHostManager(false);
      setHostToken('');
      clearVerified();
    }
  };

  const confirmCreateSpaceHandle = async () => {
    if (!isHostManager) {
      const saved = getVerified();
      if (saved && saved.token === hostToken && Date.now() - saved.at < 3600_000) {
        setIsHostManager(true);
        return;
      }
      const success = await checkHostToken(hostToken);
      if (success) {
        setVerified(hostToken);
        setIsHostManager(true);
      } else {
        messageApi.error(t('dashboard.conf.error.verify'));
      }
    } else {
      const whiteList = createSpaceWhiteList
        .split('\n')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

      const whiteListSet = new Set<string>(whiteList);
      await updateCreateSpaceConf(
        createSpaceOption,
        whiteListSet,
        (e) => {
          messageApi.error(t('dashboard.conf.error.update') + ': ' + e.message);
        },
        () => {
          messageApi.success(t('dashboard.conf.success.update'));
          setCreateSpaceConf(false);
        },
      );
    }
  };

  const handleProceed = async () => {
    if (selectOption === 'refresh') {
      await fetchAllData();
    } else if (selectOption === 'global_conf') {
      const saved = getVerified();
      if (saved && Date.now() - saved.at < 3600_000) {
        setHostToken(saved.token);
        setIsHostManager(true);
        setOpenConf(true);
      } else {
        setOpenConf(true);
      }
    } else if (selectOption === 'manage_spaces') {
      const saved = getVerified();
      if (saved && Date.now() - saved.at < 3600_000) {
        try {
          await handleVerifyHostAndLoad(saved.token);
          setOpenManage(true);
        } catch (e) {
          console.error(e);
          setOpenManage(true);
        }
      } else {
        setOpenManage(true);
      }
    } else if (selectOption === 'ac_space') {
      setCreateSpaceConf(true);
    } else if (selectOption === 'flushdb') {
      setFlushDbConfirm(true);
    }
  };

  const menuItems = [
    {
      key: 'home',
      label: t('dashboard.menu.home'),
    },
    {
      key: 'history',
      label: t('dashboard.menu.history'),
    },
    {
      key: 'recording',
      label: t('dashboard.menu.recording'),
    },
    {
      key: 'log',
      label: t('dashboard.menu.log'),
    },
  ];

  const changeMenu: MenuProps['onClick'] = (e) => {
    setMenuTab(e.key);
  };

  return (
    <div className={styles.container} style={{ position: 'relative' }}>
      {contextHolder}
      <aside className={styles.menu}>
        <Menu
          selectedKeys={[menuTab]}
          onClick={changeMenu}
          style={{ width: 256 }}
          mode="vertical"
          items={menuItems}
        />
      </aside>
      <main className={styles.main}>
        <div style={{ position: 'absolute', right: 24, top: 16, zIndex: 10 }}>
          <LangSelect></LangSelect>
        </div>
        <div style={{ marginBottom: 16 }}>
          <Title level={2}>{t('dashboard.title')}</Title>
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
        </div>

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
