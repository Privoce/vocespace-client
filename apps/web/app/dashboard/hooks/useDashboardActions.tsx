'use client';

import { MenuTab } from '@/app/dashboard/shared';
import { api } from '@/lib/api';
import { socket } from '@/lib/realtime/socket';
import { VocespaceConfig } from '@/lib/std/conf';
import { WsBase } from '@/lib/std/device';
import { ParticipantSettings, SpaceDateRecords, SpaceInfo, SpaceInfoMap } from '@/lib/std/space';
import { MenuProps } from 'antd';
import { useRef } from 'react';
import { ApiError } from '@vocespace/client-sdk';
import type { useDashboardData } from './useDashboardData';
export function useDashboardActions(context: ReturnType<typeof useDashboardData>) {
  const verificationGeneration = useRef(0);
  const {
    t,
    setMenuTab,
    messageApi,
    setOpenConf,
    setCreateSpaceConf,
    setSMTPConfOpen,
    setHyperbeamConfOpen,
    isHostManager,
    setIsHostManager,
    hostToken,
    setHostToken,
    licenseManageVisible,
    setOpenManage,
    setManageLoading,
    setManageSpaces,
    editingOwnerSpace,
    setEditingOwnerSpace,
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
    smtpConf,
    hyperbeamConf,
    selectOption,
    setFlushDbConfirm,
    createSpaceWhiteList,
    setInitializingConf,
    getVerified,
    setVerified,
    clearVerified,
    fetchAllData,
  } = context;
  const handleVerifyHostAndLoad = async (tokenOverride?: string) => {
    try {
      setManageLoading(true);
      const token = typeof tokenOverride === 'string' ? tokenOverride : hostToken;

      if (!(await ensureHostVerified(token))) return;
      const resp = await api.allSpaceInfos(token);
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
        const refreshed = await api.allSpaceInfos(hostToken);
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
        const refreshed = await api.allSpaceInfos(hostToken);
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
        api.historySpaceInfos(hostToken),
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
      if (await ensureHostVerified()) await fetchAllData();
    } else {
      setOpenConf(false);
    }
  };
  const confirmCreateSpaceHandle = async () => {
    if (!isHostManager) {
      if (await ensureHostVerified()) await fetchAllData();
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
        hostToken,
      );
    }
  };
  const ensureHostVerified = async (token = hostToken) => {
    const generation = ++verificationGeneration.current;
    setIsHostManager(false);
    try {
      if (!(await checkHostToken(token))) throw new Error('HOST_VERIFICATION_FAILED');
      if (generation !== verificationGeneration.current) return false;
      // Anonymous /api/conf omits SMTP/AI/Hyperbeam. Load the protected fields before showing forms.
      if (!(await getConf(token))) throw new Error('CONFIG_LOAD_FAILED');
      if (generation !== verificationGeneration.current) return false;
      setVerified(token);
      setHostToken(token);
      setIsHostManager(true);
      return true;
    } catch (error) {
      if (generation !== verificationGeneration.current) return false;
      clearVerified();
      const key = error instanceof ApiError && error.code === 'ORIGIN_DENIED'
        ? 'origin'
        : error instanceof Error && error.message === 'HOST_VERIFICATION_FAILED'
          ? 'verify'
          : error instanceof Error && error.message === 'CONFIG_LOAD_FAILED'
            ? 'load'
            : 'request';
      messageApi.error(t(`dashboard.conf.error.${key}`));
      return false;
    }
  };
  const confirmSMTPConfHandle = async () => {
    if (!isHostManager) {
      if (await ensureHostVerified()) await fetchAllData();
      return;
    }
    await updateSMTPConf(
      hostToken,
      smtpConf,
      (e) => {
        messageApi.error(t('dashboard.conf.error.update') + ': ' + e.message);
      },
      () => {
        messageApi.success(t('dashboard.conf.success.update'));
        setSMTPConfOpen(false);
      },
    );
  };
  const confirmHyperbeamConfHandle = async () => {
    if (!isHostManager) {
      if (await ensureHostVerified()) await fetchAllData();
      return;
    }
    await updateHyperbeamConf(
      hostToken,
      hyperbeamConf,
      (e) => {
        messageApi.error(t('dashboard.conf.error.update') + ': ' + e.message);
      },
      () => {
        messageApi.success(t('dashboard.conf.success.update'));
        setHyperbeamConfOpen(false);
      },
    );
  };
  const handleSetupConf = async (setupData: VocespaceConfig) => {
    try {
      setInitializingConf(true);
      await setupConf(
        setupData,
        (e) => {
          throw e;
        },
        async () => {
          await fetchAllData();
          setMenuTab('home');
          messageApi.success(t('dashboard.conf.success.update'));
        },
        hostToken,
      );
    } catch (e) {
      const error = e as Error;
      messageApi.error(t('dashboard.conf.error.update') + ': ' + error.message);
    } finally {
      setInitializingConf(false);
    }
  };
  const handleProceed = async () => {
    if (selectOption === 'refresh') {
      await fetchAllData();
    } else if (['global_conf', 'ac_space', 'smtp_conf', 'hyperbeam_conf'].includes(selectOption)) {
      setIsHostManager(false);
      const saved = getVerified();
      if (saved) await ensureHostVerified(saved.token);
      else setHostToken('');
      if (selectOption === 'global_conf') setOpenConf(true);
      if (selectOption === 'ac_space') setCreateSpaceConf(true);
      if (selectOption === 'smtp_conf') setSMTPConfOpen(true);
      if (selectOption === 'hyperbeam_conf') setHyperbeamConfOpen(true);
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
        setIsHostManager(false);
        setOpenManage(true);
      }
    } else if (selectOption === 'flushdb') {
      setFlushDbConfirm(true);
    }
  };
  const menuItems = [
    {
      key: 'drive',
      label: t('dashboard.menu.drive'),
    },
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
    {
      key: 'license',
      label: t('dashboard.menu.license'),
    },
    ...(licenseManageVisible
      ? [
        {
          key: 'licenseManage',
          label: t('dashboard.menu.licenseManage'),
        },
      ]
      : []),
  ];
  const changeMenu: MenuProps['onClick'] = (e) => {
    setMenuTab(e.key as MenuTab);
  };
  return {
    ...context,
    handleVerifyHostAndLoad,
    handleCloseManage,
    handleDeleteSpace,
    handleEditOwner,
    handleSaveNewOwner,
    handleExportSpace,
    confirmConfHandle,
    confirmCreateSpaceHandle,
    ensureHostVerified,
    confirmSMTPConfHandle,
    confirmHyperbeamConfHandle,
    handleSetupConf,
    handleProceed,
    menuItems,
    changeMenu,
  };
}
