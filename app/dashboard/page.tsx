'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Table,
  Card,
  Badge,
  Tag,
  Button,
  Space,
  Typography,
  Statistic,
  Row,
  Col,
  message,
  Modal,
  Input,
  Tabs,
  Select,
  Popconfirm,
  Radio,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { SvgResource } from '../resources/svg';
import styles from '@/styles/dashboard.module.scss';
import { api } from '@/lib/api';
import { ConfQulity, useRTCConf, useVoceSpaceConf } from '../pages/controls/settings/conf';
import { ParticipantSettings, SpaceDateRecords, SpaceInfo, SpaceInfoMap } from '@/lib/std/space';
import { useI18n } from '@/lib/i18n/i18n';
import { LangSelect } from '../pages/controls/selects/lang_select';
import { usePlatformUserInfoCheap } from '@/lib/hooks/platform';
import { socket } from '../[spaceName]/PageClientImpl';
import { WsBase } from '@/lib/std/device';
import { CreateSpaceStrategy } from '@/lib/std/conf';

const { Title } = Typography;

const countDuring = (startAt: number): string => {
  if (!startAt) return '0m';
  const now = Date.now();
  const duration = Math.floor((now - startAt) / 1000); // 秒
  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  return `${hours}h ${minutes}m`;
};

interface LeaderboardData {
  key: string;
  participantName: string;
  spaceId: string;
  totalDuration: number; // 总时长（毫秒）
  periodDuration: number; // 期间时长（毫秒）
  totalDisplay: string; // 总时长显示
  periodDisplay: string; // 期间时长显示
}

interface HistorySpaceData {
  key: string;
  room: string;
  during: string; // 总使用时长
  today: string; // 今日使用时长
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

type ActionKey = 'refresh' | 'global_conf' | 'manage_spaces' | 'ac_space';

export default function Dashboard() {
  const { t } = useI18n();
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

  // 根据 Space 分组数据
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

  // 统一获取所有数据（当前空间和历史数据）
  const fetchAllData = async () => {
    setLoading(true);
    try {
      // 同时获取当前空间信息和历史记录
      const [spaceResponse, historyResponse] = await Promise.all([
        api.allSpaceInfos(),
        api.historySpaceInfos(),
      ]);

      // 处理历史数据
      let records: SpaceDateRecords | null = null;
      if (historyResponse.ok) {
        const result = await historyResponse.json();
        records = result.records;
      } else {
        messageApi.error(t('dashboard.history_fetch_failed'));
      }

      // 构建历史时长映射 { spaceId: { participantName: totalDuration } }
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

        // 处理历史数据和榜单
        processHistoryData(records);
      }

      // 处理当前空间数据
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

                // 从历史记录中获取该用户的总时长
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

  // 处理历史数据和榜单
  const processHistoryData = (records: SpaceDateRecords) => {
    // 转为 HistorySpaceData 格式
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

    // 遍历records中的记录
    for (const [spaceId, timeRecords] of Object.entries(records)) {
      // 计算房间总使用时长和今日使用时长
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

      // 计算参与者榜单数据
      const dailyParticipants: { [name: string]: { total: number; period: number } } = {};
      const weeklyParticipants: { [name: string]: { total: number; period: number } } = {};
      const monthlyParticipants: { [name: string]: { total: number; period: number } } = {};

      // 处理参与者记录
      Object.entries(timeRecords.participants).forEach(([participantName, records]) => {
        let totalDuration = 0;
        let dailyDuration = 0;
        let weeklyDuration = 0;
        let monthlyDuration = 0;

        records.forEach((record) => {
          const end = record.end || Date.now();
          const duration = end - record.start;
          totalDuration += duration;

          // 计算日榜 - 处理跨日的情况
          const recordEnd = Math.min(end, todayEnd);
          const recordStart = Math.max(record.start, todayStart);
          if (recordStart <= todayEnd && recordEnd >= todayStart) {
            dailyDuration += Math.max(0, recordEnd - recordStart);
          }

          // 计算周榜 - 处理跨周的情况
          const weekRecordEnd = Math.min(end, weekEnd);
          const weekRecordStart = Math.max(record.start, weekStart);
          if (weekRecordStart <= weekEnd && weekRecordEnd >= weekStart) {
            weeklyDuration += Math.max(0, weekRecordEnd - weekRecordStart);
          }

          // 计算月榜 - 处理跨月的情况
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

      // 转换为LeaderboardData格式
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

    // 每120秒刷新一次数据
    const interval = setInterval(() => {
      fetchAllData();
    }, 120000);

    return () => clearInterval(interval);
  }, []);

  // 管理空间: 验证 Host Token 并加载空间列表
  const handleVerifyHostAndLoad = async (tokenOverride?: string) => {
    try {
      setManageLoading(true);
      const token = tokenOverride ?? hostToken;

      // 如果本地已有验证并且 token 相同且在1小时内，则直接使用
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
      // 记录本次验证
      setVerified(token);
      setHostToken(token);
      setIsHostManager(true);
      // 获取所有空间信息
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

  // 删除空间（前端将调用 updateSpaceInfo 设置 participants 清空，后端如果有删除 API 可替换）
  const handleDeleteSpace = async (spaceName: string) => {
    try {
      setManageLoading(true);
      // 尝试调用后端删除接口：如果没有专门删除接口，清空 participants 作为替代（视后端实现）
      const resp = await api.deleteSpace(spaceName);
      if (!resp.ok) {
        messageApi.error(t('dashboard.delete_failed'));
      } else {
        messageApi.success(t('dashboard.delete_success'));
        // refresh
        const refreshed = await api.allSpaceInfos();
        if (refreshed.ok) {
          const spaces: SpaceInfoMap = await refreshed.json();
          setManageSpaces(spaces);
          // 同步主界面
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

  // 显示修改 owner 的候选用户（从 getSpaceInfo 获取 participants）
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
        // refresh list
        const refreshed = await api.allSpaceInfos();
        if (refreshed.ok) {
          const spaces: SpaceInfoMap = await refreshed.json();
          setManageSpaces(spaces);
          await fetchAllData();
        }
        setEditingOwnerSpace(null);
        setSelectedNewOwner(null);
        // socket update
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

  // 导出空间数据为 Markdown 并下载
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

      // 构造 markdown
      let md = `- 空间: ${spaceName}\n`;
      md += `- 子房间:\n`;
      if (spaceInfo.children && spaceInfo.children.length > 0) {
        for (const child of spaceInfo.children) {
          const users = child.participants.join(', ');
          md += `    - ${child.name}: ${users}\n`;
        }
      } else {
        md += '    - 无\n';
      }

      md += `- 用户:\n`;
      // 使用 history records 优先，如果没有则使用 spaceInfo.participants
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

      // 下载 md
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

  // 当前房间参与者表格列定义（去掉房间列，因为现在按Space分组显示）
  const currentSpacesColumns: ColumnsType<ParticipantTableData> = [
    {
      title: t('dashboard.active.table.participant'),
      dataIndex: 'name',
      key: 'name',
      width: 150,
      render: (name: string, record) => (
        <Space align="center">
          <span>{name}</span>
          {record.isOwner && '(host)'}
          {record.isRecording && (
            <SvgResource type="record" svgSize={16} color="#ffffff"></SvgResource>
          )}
        </Space>
      ),
    },
    {
      title: t('dashboard.active.table.state'),
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: boolean) => <Tag color="blue">{status ? 'Online' : 'Offline'}</Tag>,
    },
    {
      title: (
        <div className={styles.table_header}>
          <SvgResource type="volume" svgSize={16} color="#ffffff"></SvgResource>
          {t('dashboard.active.table.volume')}
        </div>
      ),
      dataIndex: 'volume',
      key: 'volume',
      width: 80,
      render: (volume: number) => (
        <Space align="center">
          <span>{volume}%</span>
        </Space>
      ),
    },
    {
      title: (
        <div className={styles.table_header}>
          <SvgResource type="blur" svgSize={16} color="#ffffff"></SvgResource>
          {t('dashboard.active.table.blur')}
        </div>
      ),
      dataIndex: 'blur',
      key: 'blur',
      width: 100,
      render: (blur: number) => (
        <Space align="center">
          <span>{blur * 100}%</span>
        </Space>
      ),
    },
    {
      title: (
        <div className={styles.table_header}>
          <SvgResource type="blur" svgSize={16} color="#ffffff"></SvgResource>
          {t('dashboard.active.table.screen_blur')}
        </div>
      ),
      dataIndex: 'screenBlur',
      key: 'screenBlur',
      width: 100,

      render: (screenBlur: number) => (
        <Space align="center">
          <span>{screenBlur * 100}%</span>
        </Space>
      ),
    },
    {
      title: t('dashboard.active.table.is_auth'),
      dataIndex: 'isAuth',
      key: 'isAuth',
      width: 100,
      render: (enabled: boolean) => (
        <Badge status={enabled ? 'success' : 'default'} text={enabled ? 'true' : 'false'} />
      ),
    },
    {
      title: t('dashboard.active.table.during'),
      dataIndex: 'during',
      key: 'during',
      width: 100,
      ellipsis: true,
    },
  ];

  // 历史房间表格列定义
  const historySpacesColumns: ColumnsType<HistorySpaceData> = [
    {
      title: t('dashboard.count.history.table.room'),
      dataIndex: 'room',
      key: 'room',
      width: 200,
    },
    {
      title: t('dashboard.count.history.table.total'),
      dataIndex: 'during',
      key: 'during',
      width: 150,
      sorter: (a, b) => {
        // 简单的时长排序逻辑
        const parseTime = (time: string) => {
          const hours = time.includes('h') ? parseInt(time.split('h')[0]) : 0;
          const minutes = time.includes('m')
            ? parseInt(time.split('m')[0].split(' ').pop() || '0')
            : 0;
          return hours * 60 + minutes;
        };
        return parseTime(a.during) - parseTime(b.during);
      },
    },
    {
      title: t('dashboard.count.history.table.today'),
      dataIndex: 'today',
      key: 'today',
      width: 150,
      sorter: (a, b) => {
        const parseTime = (time: string) => {
          const hours = time.includes('h') ? parseInt(time.split('h')[0]) : 0;
          const minutes = time.includes('m')
            ? parseInt(time.split('m')[0].split(' ').pop() || '0')
            : 0;
          return hours * 60 + minutes;
        };
        return parseTime(a.today) - parseTime(b.today);
      },
    },
  ];

  // 榜单表格列定义
  const createLeaderboardColumns = (periodTitle: string): ColumnsType<LeaderboardData> => [
    {
      title: t('dashboard.active.table.participant'),
      dataIndex: 'participantName',
      key: 'participantName',
      width: 150,
    },
    {
      title: `${periodTitle}${t('dashboard.common.during')}`,
      dataIndex: 'periodDisplay',
      key: 'periodDisplay',
      width: 120,
      sorter: (a, b) => a.periodDuration - b.periodDuration,
      defaultSortOrder: 'descend',
    },
    {
      title: `${t('dashboard.common.total')}${t('dashboard.common.during')}`,
      dataIndex: 'totalDisplay',
      key: 'totalDisplay',
      width: 120,
      sorter: (a, b) => a.totalDuration - b.totalDuration,
    },
  ];

  const dailyColumns = createLeaderboardColumns(t('dashboard.common.day'));
  const weeklyColumns = createLeaderboardColumns(t('dashboard.common.week'));
  const monthlyColumns = createLeaderboardColumns(t('dashboard.common.month'));

  const confirmConfHandle = async () => {
    if (!isHostManager) {
      // 先检查本地缓存
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
      // 当修改后
      setOpenConf(false);
      setIsHostManager(false);
      setHostToken('');
      clearVerified();
    }
  };

  const confirmCreateSpaceHandle = async () => {
    if (!isHostManager) {
      // 先检查本地缓存
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
      // 保存配置
      const whiteList = createSpaceWhiteList
        .split('\n')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

      // 转为HashSet进行去重
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

  return (
    <div className={styles.container} style={{ position: 'relative' }}>
      {contextHolder}
      <div style={{ position: 'absolute', right: 24, top: 16 }}>
        <LangSelect></LangSelect>
      </div>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>VoceSpace Dashboard</Title>
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={4}>
            <Card>
              <Statistic title={t('dashboard.count.room')} value={totalSpaces} />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title={t('dashboard.count.participant')}
                value={totalParticipants}
                prefix={<SvgResource type="user" svgSize={16} color="#ffffff"></SvgResource>}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title={t('dashboard.count.online_participant')}
                value={onlineParticipants}
                prefix={<SvgResource type="user" svgSize={16} color="#ffffff"></SvgResource>}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title={t('dashboard.count.platform')}
                value={authParticipants}
                prefix={<SvgResource type="user" svgSize={16} color="#ffffff"></SvgResource>}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <div style={{ marginBottom: '9px' }}>{t('dashboard.count.opt')}</div>
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                }}
              >
                {/* <Button
                  type="primary"
                  onClick={async () => {
                    await fetchAllData();
                  }}
                  loading={loading}
                >
                  {t('dashboard.count.refresh')}
                </Button>
                <Button
                  color="danger"
                  variant="solid"
                  onClick={() => {
                    const saved = getVerified();
                    if (saved && Date.now() - saved.at < 3600_000) {
                      setHostToken(saved.token);
                      setIsHostManager(true);
                      setOpenConf(true);
                    } else {
                      setOpenConf(true);
                    }
                  }}
                >
                  {t('dashboard.count.global_conf')}
                </Button>
                <Button
                  type="primary"
                  onClick={async () => {
                    const saved = getVerified();
                    if (saved && Date.now() - saved.at < 3600_000) {
                      // 直接使用缓存 token 调用验证加载，避免依赖 setHostToken 的异步更新
                      try {
                        await handleVerifyHostAndLoad(saved.token);
                        setOpenManage(true);
                      } catch (e) {
                        console.error(e);
                        // 打开 modal 让用户手动输入
                        setOpenManage(true);
                      }
                    } else {
                      setOpenManage(true);
                    }
                  }}
                >
                  {t('dashboard.manage_spaces')}
                </Button> */}
                <Select
                  value={selectOption}
                  style={{ flex: 1 }}
                  onChange={(v) => {
                    setSelectOption(v as ActionKey);
                  }}
                  options={[
                    {
                      label: t('dashboard.count.refresh'),
                      key: 'refresh',
                      loading: loading,
                      value: 'refresh',
                    },
                    {
                      label: t('dashboard.count.global_conf'),
                      key: 'global_conf',
                      value: 'global_conf',
                    },
                    {
                      label: t('dashboard.manage_spaces'),
                      key: 'manage_spaces',
                      value: 'manage_spaces',
                    },
                    {
                      label: t('dashboard.count.allow_create_space'),
                      key: 'ac_space',
                      value: 'ac_space',
                    },
                  ]}
                ></Select>
                <Button
                  type="primary"
                  loading={loading}
                  onClick={async () => {
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
                        // 直接使用缓存 token 调用验证加载，避免依赖 setHostToken 的异步更新
                        try {
                          await handleVerifyHostAndLoad(saved.token);
                          setOpenManage(true);
                        } catch (e) {
                          console.error(e);
                          // 打开 modal 让用户手动输入
                          setOpenManage(true);
                        }
                      } else {
                        setOpenManage(true);
                      }
                    } else if (selectOption === 'ac_space') {
                      setCreateSpaceConf(true);
                    }
                  }}
                >
                  Handle
                </Button>
              </div>
            </Card>
          </Col>
        </Row>
      </div>

      {/* 当前房间用户数据 - 按Space分组 */}
      <Card style={{ marginBottom: 24 }}>
        {Object.keys(groupedSpacesData).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
            {t('dashboard.active.empty_room')}
          </div>
        ) : (
          <>
            <Typography.Title level={5}>{t('dashboard.active.title')}</Typography.Title>
            <Tabs
              items={Object.entries(groupedSpacesData).map(([spaceId, participants]) => ({
                key: spaceId,
                label: (
                  <Space>
                    <span>{spaceId}</span>
                    <Badge count={participants.length} size="small" />
                    {participants.some((p) => p.isRecording) && (
                      <SvgResource type="record" svgSize={14} color="#ff4d4f" />
                    )}
                  </Space>
                ),
                children: (
                  <Table
                    columns={currentSpacesColumns}
                    dataSource={participants}
                    loading={loading}
                    pagination={{
                      pageSize: 10,
                      showSizeChanger: true,
                      showQuickJumper: true,
                      showTotal: (total, range) =>
                        `${t('recording.pagation.now')} ${range[0]}-${range[1]} ${t(
                          'recording.pagation.num',
                        )}, ${t('recording.pagation.total')} ${total} ${t(
                          'recording.pagation.num',
                        )}`,
                    }}
                    scroll={{ x: 1000 }}
                  />
                ),
              }))}
            />
          </>
        )}
      </Card>

      {/* 历史数据和榜单 */}
      <Card style={{ marginBottom: 24 }}>
        <Tabs
          items={[
            {
              key: 'history',
              label: t('dashboard.count.history.title'),
              children: (
                <Table
                  columns={historySpacesColumns}
                  dataSource={historySpacesData}
                  pagination={{
                    pageSize: 10,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total, range) =>
                      `${t('recording.pagation.now')} ${range[0]}-${range[1]} ${t(
                        'recording.pagation.num',
                      )}, ${t('recording.pagation.total')} ${total} ${t('recording.pagation.num')}`,
                  }}
                />
              ),
            },
            {
              key: 'daily',
              label: t('dashboard.count.history.day'),
              children:
                Object.keys(dailyLeaderboard).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                    {t('dashboard.count.history.empty')}
                  </div>
                ) : (
                  <Tabs
                    type="card"
                    size="small"
                    items={Object.entries(dailyLeaderboard).map(([spaceId, participants]) => ({
                      key: `daily-${spaceId}`,
                      label: (
                        <Space>
                          <span>{spaceId}</span>
                          <Badge count={participants.length} size="small" />
                        </Space>
                      ),
                      children: (
                        <Table
                          columns={dailyColumns}
                          dataSource={participants}
                          pagination={{
                            pageSize: 10,
                            showSizeChanger: true,
                            showQuickJumper: true,
                            showTotal: (total, range) =>
                              `${t('recording.pagation.now')} ${range[0]}-${range[1]} ${t(
                                'recording.pagation.num',
                              )}, ${t('recording.pagation.total')} ${total} ${t(
                                'recording.pagation.num',
                              )}`,
                          }}
                          scroll={{ x: 600 }}
                        />
                      ),
                    }))}
                  />
                ),
            },
            {
              key: 'weekly',
              label: t('dashboard.count.history.week'),
              children:
                Object.keys(weeklyLeaderboard).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                    {t('dashboard.count.history.empty')}
                  </div>
                ) : (
                  <Tabs
                    type="card"
                    size="small"
                    items={Object.entries(weeklyLeaderboard).map(([spaceId, participants]) => ({
                      key: `weekly-${spaceId}`,
                      label: (
                        <Space>
                          <span>{spaceId}</span>
                          <Badge count={participants.length} size="small" />
                        </Space>
                      ),
                      children: (
                        <Table
                          columns={weeklyColumns}
                          dataSource={participants}
                          pagination={{
                            pageSize: 10,
                            showSizeChanger: true,
                            showQuickJumper: true,
                            showTotal: (total, range) =>
                              `${t('recording.pagation.now')} ${range[0]}-${range[1]} ${t(
                                'recording.pagation.num',
                              )}, ${t('recording.pagation.total')} ${total} ${t(
                                'recording.pagation.num',
                              )}`,
                          }}
                          scroll={{ x: 600 }}
                        />
                      ),
                    }))}
                  />
                ),
            },
            {
              key: 'monthly',
              label: t('dashboard.count.history.month'),
              children:
                Object.keys(monthlyLeaderboard).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                    {t('dashboard.count.history.empty')}
                  </div>
                ) : (
                  <Tabs
                    type="card"
                    size="small"
                    items={Object.entries(monthlyLeaderboard).map(([spaceId, participants]) => ({
                      key: `monthly-${spaceId}`,
                      label: (
                        <Space>
                          <span>{spaceId}</span>
                          <Badge count={participants.length} size="small" />
                        </Space>
                      ),
                      children: (
                        <Table
                          columns={monthlyColumns}
                          dataSource={participants}
                          pagination={{
                            pageSize: 10,
                            showSizeChanger: true,
                            showQuickJumper: true,
                            showTotal: (total, range) =>
                              `${t('recording.pagation.now')} ${range[0]}-${range[1]} ${t(
                                'recording.pagation.num',
                              )}, ${t('recording.pagation.total')} ${total} ${t(
                                'recording.pagation.num',
                              )}`,
                          }}
                          scroll={{ x: 600 }}
                        />
                      ),
                    }))}
                  />
                ),
            },
          ]}
        />
      </Card>
      {/* 配置是否允许创建空间 */}
      <Modal
        title={t('dashboard.conf.create_space')}
        open={createSpaceConf}
        onCancel={() => {
          setCreateSpaceConf(false);
        }}
        footer={
          <Button type="primary" onClick={confirmCreateSpaceHandle}>
            {!isHostManager ? t('dashboard.conf.verify') : t('dashboard.save')}
          </Button>
        }
      >
        {isHostManager ? (
          <div>
            <div>
              <div>{t('dashboard.conf.create_space_desc.0')}</div>
              <div>{t('dashboard.conf.create_space_desc.1')}</div>
              <div>{t('dashboard.conf.create_space_desc.2')}</div>
              <div>{t('dashboard.conf.create_space_desc.3')}</div>
            </div>
            <Radio.Group
              block
              size="large"
              optionType="button"
              value={createSpaceOption}
              onChange={(e) => {
                setCreateSpaceOption(e.target.value);
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                margin: '16px 0',
              }}
              options={[
                {
                  label: t("dashboard.conf.create_space_option.all"),
                  value: 'all',
                  style: { width: '100%' },
                },
                {
                  label: t("dashboard.conf.create_space_option.white"),
                  value: 'white',
                  style: { width: '100%' },
                },
                {
                  label: t("dashboard.conf.create_space_option.white_platform"),
                  value: 'white_platform',
                  style: { width: '100%' },
                },
              ]}
            ></Radio.Group>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div>
                <div>{t('dashboard.conf.white_list')}</div>
                <div>{t('dashboard.conf.white_list_desc.0')}</div>
                <div>{t('dashboard.conf.white_list_desc.1')}</div>
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                }}
              >
                <Input
                  value={addWhiteListValue}
                  onChange={(e) => {
                    setAddWhiteListValue(e.target.value);
                  }}
                ></Input>
                <Button
                  type="primary"
                  onClick={() => {
                    const currentList = createSpaceWhiteList
                      ? createSpaceWhiteList.split('\n').map((s) => s.trim())
                      : [];
                    if (addWhiteListValue && !currentList.includes(addWhiteListValue.trim())) {
                      currentList.push(addWhiteListValue.trim());
                      setCreateSpaceWhiteList(currentList.join('\n'));
                      setAddWhiteListValue('');
                    } else {
                      messageApi.warning(t('dashboard.conf.white_list_exist'));
                    }
                  }}
                >
                  {t('dashboard.conf.add_white_list')}
                </Button>
                <Button
                  variant="filled"
                  danger
                  onClick={() => {
                    const currentList = createSpaceWhiteList
                      ? createSpaceWhiteList.split('\n').map((s) => s.trim())
                      : [];
                    if (addWhiteListValue && currentList.includes(addWhiteListValue.trim())) {
                      const newList = currentList.filter((s) => s !== addWhiteListValue.trim());
                      setCreateSpaceWhiteList(newList.join('\n'));
                      setAddWhiteListValue('');
                    } else {
                      messageApi.warning(t('dashboard.conf.white_list_not_exist'));
                    }
                  }}
                >
                  {t('dashboard.conf.delete_white_list')}
                </Button>
              </div>
              <Input.TextArea
                placeholder={t('dashboard.conf.white_list')}
                value={createSpaceWhiteList}
                autoSize
                disabled
              ></Input.TextArea>
            </div>
          </div>
        ) : (
          <Input
            placeholder={t('dashboard.conf.placeholder')}
            value={hostToken}
            onChange={(e) => {
              setHostToken(e.target.value);
            }}
          ></Input>
        )}
      </Modal>
      {/* 配置画质 */}
      <Modal
        title={t('dashboard.conf.resolution')}
        open={openConf}
        onCancel={() => {
          setOpenConf(false);
        }}
        footer={
          <Button type="primary" onClick={confirmConfHandle}>
            {!isHostManager ? t('dashboard.conf.verify') : t('dashboard.conf.close')}
          </Button>
        }
      >
        {isHostManager ? (
          <ConfQulity
            space=""
            isOwner={isHostManager}
            messageApi={messageApi}
            onReload={() => {
              setHostToken('');
              setOpenConf(false);
              setIsHostManager(false);
              messageApi.success(t('dashboard.conf.success.update'));
            }}
          ></ConfQulity>
        ) : (
          <Input
            placeholder={t('dashboard.conf.placeholder')}
            value={hostToken}
            onChange={(e) => {
              setHostToken(e.target.value);
            }}
          ></Input>
        )}
      </Modal>
      {/* 管理空间 Modal */}
      <Modal
        title={t('dashboard.manage_spaces')}
        open={openManage}
        onCancel={handleCloseManage}
        width={800}
        footer={null}
      >
        {!isHostManager ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <Input
              placeholder={t('dashboard.host_token_placeholder')}
              value={hostToken}
              onChange={(e) => setHostToken(e.target.value)}
            />
            <Button
              loading={manageLoading}
              onClick={async () => await handleVerifyHostAndLoad()}
              type="primary"
            >
              {t('dashboard.verify_and_load')}
            </Button>
          </div>
        ) : (
          <div style={{ overflow: 'auto', maxWidth: '100%' }}>
            <div style={{ marginBottom: 12 }}>
              <Button
                onClick={async () => {
                  setIsHostManager(false);
                  setHostToken('');
                  clearVerified();
                }}
              >
                {t('dashboard.logout')}
              </Button>
            </div>
            <Table
              dataSource={
                manageSpaces
                  ? Object.entries(manageSpaces).map(([k, v]) => ({
                      key: k,
                      space: k,
                      ownerId: v.ownerId,
                      ownerName: v.participants?.[v.ownerId]?.name || '',
                    }))
                  : []
              }
              loading={manageLoading}
              pagination={{ pageSize: 8 }}
              columns={[
                { title: 'Space', dataIndex: 'space', key: 'space', width: 200 },
                { title: 'Owner', dataIndex: 'ownerName', key: 'ownerName', width: 140 },
                {
                  title: 'Actions',
                  fixed: 'right',
                  key: 'actions',
                  render: (_: any, record: any) => (
                    <Space>
                      <Popconfirm
                        title={t('dashboard.confirm_delete_space')}
                        onConfirm={() => handleDeleteSpace(record.space)}
                        okText={t('dashboard.yes')}
                        cancelText={t('dashboard.no')}
                      >
                        <Button danger size="small">
                          {t('dashboard.delete_space_button')}
                        </Button>
                      </Popconfirm>
                      <Button size="small" onClick={() => handleEditOwner(record.space)}>
                        {t('dashboard.edit_owner_button')}
                      </Button>
                      <Button size="small" onClick={() => handleExportSpace(record.space)}>
                        {t('dashboard.export_space_button')}
                      </Button>
                    </Space>
                  ),
                },
              ]}
            />

            {/* 修改 owner 的 Modal */}
            <Modal
              title={t('dashboard.edit_owner_modal_title')}
              open={!!editingOwnerSpace}
              onCancel={() => setEditingOwnerSpace(null)}
              footer={
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button onClick={() => setEditingOwnerSpace(null)}>
                    {t('dashboard.cancel')}
                  </Button>
                  <Button type="primary" loading={manageLoading} onClick={handleSaveNewOwner}>
                    {t('dashboard.save')}
                  </Button>
                </div>
              }
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ minWidth: 120 }}>{editingOwnerSpace}</div>
                <Select
                  style={{ minWidth: 240 }}
                  placeholder="new owner"
                  value={selectedNewOwner || undefined}
                  onChange={(val) => setSelectedNewOwner(val)}
                >
                  {ownerCandidates.map((c) => (
                    <Select.Option key={c.id} value={c.id}>
                      {c.name} ({c.id})
                    </Select.Option>
                  ))}
                </Select>
              </div>
            </Modal>
          </div>
        )}
      </Modal>
    </div>
  );
}
