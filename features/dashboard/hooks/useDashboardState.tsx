'use client';

import { useVoceSpaceConf } from '@/app/pages/controls/settings/conf';
import { ActionKey, HistorySpaceData, LeaderboardData, MenuTab, ParticipantTableData } from '@/features/dashboard/shared';
import { useLayoutDevice } from '@/lib/hooks/use-layout-device';
import { useSocketSession } from '@/lib/hooks/use-socket-session';
import { useI18n } from '@/lib/i18n/i18n';
import { CreateSpaceStrategy, DEFAULT_VOCESPACE_CONFIG, HyperbeamConf, SMTPConf } from '@/lib/std/conf';
import { SpaceInfoMap } from '@/lib/std/space';
import { message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
export function useDashboardState() {
  const device = useLayoutDevice();
  useSocketSession();
  const { t } = useI18n();
  const [menuTab, setMenuTab] = useState<MenuTab>('home');
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
  const [historyTotalRooms, setHistoryTotalRooms] = useState(0);
  const [historyTotalUsers, setHistoryTotalUsers] = useState(0);
  const [historyPlatformUsers, setHistoryPlatformUsers] = useState(0);
  const [historyAvgDuration, setHistoryAvgDuration] = useState('0h 0m');
  const [messageApi, contextHolder] = message.useMessage();
  const [openConf, setOpenConf] = useState(false);
  const [createSpaceConf, setCreateSpaceConf] = useState(false);
  const [smtpConfOpen, setSMTPConfOpen] = useState(false);
  const [hyperbeamConfOpen, setHyperbeamConfOpen] = useState(false);
  const [isHostManager, setIsHostManager] = useState(false);
  const [hostToken, setHostToken] = useState('');
  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [licenseManageVisible, setLicenseManageVisible] = useState(false);
  const [openManage, setOpenManage] = useState(false);
  const [manageLoading, setManageLoading] = useState(false);
  const [manageSpaces, setManageSpaces] = useState<SpaceInfoMap | null>(null);
  const [editingOwnerSpace, setEditingOwnerSpace] = useState<string | null>(null);
  const [ownerCandidates, setOwnerCandidates] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedNewOwner, setSelectedNewOwner] = useState<string | null>(null);
  const { conf, getConf, checkHostToken, updateCreateSpaceConf, updateSMTPConf, updateHyperbeamConf, setupConf } = useVoceSpaceConf();
  const [createSpaceOption, setCreateSpaceOption] = useState<CreateSpaceStrategy>(
    conf?.create_space || 'all',
  );
  const [smtpConf, setSMTPConf] = useState<SMTPConf>(DEFAULT_VOCESPACE_CONFIG.smtp!);
  const [hyperbeamConf, setHyperbeamConf] = useState<HyperbeamConf>(
    DEFAULT_VOCESPACE_CONFIG.hyperbeam!,
  );
  const [addWhiteListValue, setAddWhiteListValue] = useState<string>('');
  const [selectOption, setSelectOption] = useState<ActionKey>('refresh');
  const [flushDbConfirm, setFlushDbConfirm] = useState(false);
  const [manageSearchText, setManageSearchText] = useState('');
  const [createSpaceWhiteList, setCreateSpaceWhiteList] = useState<string>('');
  const [initializingConf, setInitializingConf] = useState(false);
  const VERIFIED_KEY = 'vocespace_host_token_verified';
  useEffect(() => {
    if (conf) {
      setCreateSpaceOption(conf?.create_space || 'all');
      setSMTPConf(conf.smtp || DEFAULT_VOCESPACE_CONFIG.smtp!);
      setHyperbeamConf(conf.hyperbeam || DEFAULT_VOCESPACE_CONFIG.hyperbeam!);
      if (conf.initialized === false) {
        setMenuTab('drive');
      }
      if (conf.whiteList && conf.whiteList.length > 0) {
        setCreateSpaceWhiteList(conf.whiteList.join('\n'));
      } else {
        setCreateSpaceWhiteList('');
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
  return {
    t,
    menuTab,
    setMenuTab,
    pageSize1,
    setPageSize1,
    pageSize2,
    setPageSize2,
    currentSpacesData,
    setCurrentSpacesData,
    historySpacesData,
    setHistorySpacesData,
    dailyLeaderboard,
    setDailyLeaderboard,
    weeklyLeaderboard,
    setWeeklyLeaderboard,
    monthlyLeaderboard,
    setMonthlyLeaderboard,
    loading,
    setLoading,
    totalSpaces,
    setTotalSpaces,
    totalParticipants,
    setTotalParticipants,
    onlineParticipants,
    setOnlineParticipants,
    authParticipants,
    setAuthParticipants,
    activeRecordings,
    setActiveRecordings,
    historyTotalRooms,
    setHistoryTotalRooms,
    historyTotalUsers,
    setHistoryTotalUsers,
    historyPlatformUsers,
    setHistoryPlatformUsers,
    historyAvgDuration,
    setHistoryAvgDuration,
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
    webhookEnabled,
    setWebhookEnabled,
    licenseManageVisible,
    setLicenseManageVisible,
    openManage,
    setOpenManage,
    manageLoading,
    setManageLoading,
    manageSpaces,
    setManageSpaces,
    editingOwnerSpace,
    setEditingOwnerSpace,
    ownerCandidates,
    setOwnerCandidates,
    selectedNewOwner,
    setSelectedNewOwner,
    conf,
    getConf,
    checkHostToken,
    updateCreateSpaceConf,
    updateSMTPConf,
    updateHyperbeamConf,
    setupConf,
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
    setInitializingConf,
    VERIFIED_KEY,
    getVerified,
    setVerified,
    clearVerified,
    groupedSpacesData,
    device,
  };
}
