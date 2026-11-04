'use client';

import { apiFetch } from '@/lib/api/client';

import { HistorySpaceData, LeaderboardData, ParticipantTableData } from '@/app/dashboard/shared';
import { api } from '@/lib/api';
import { useLatestCallback } from '@/lib/hooks/use-latest-callback';
import type { DashboardSnapshot } from '@vocespace/contracts';
import { SpaceDateRecords } from '@/lib/std/space';
import { useEffect } from 'react';
import type { useDashboardState } from './useDashboardState';

export function useDashboardData(context: ReturnType<typeof useDashboardState>) {
  const {
    t,
    setCurrentSpacesData,
    setHistorySpacesData,
    setDailyLeaderboard,
    setWeeklyLeaderboard,
    setMonthlyLeaderboard,
    setLoading,
    setTotalSpaces,
    setTotalParticipants,
    setOnlineParticipants,
    setAuthParticipants,
    setActiveRecordings,
    setHistoryTotalRooms,
    setHistoryTotalUsers,
    setHistoryPlatformUsers,
    setHistoryAvgDuration,
    messageApi,
    setWebhookEnabled,
    setLicenseManageVisible,
    getConf,
  } = context;
  const fetchAllData = async () => {
    setLoading(true);
    try {
      const response = await api.dashboardData();
      if (!response.ok) {
        messageApi.error(t('dashboard.spaces_fetch_failed'));
        return;
      }
      const { spaces: spaceInfoMap, records } = await response.json() as DashboardSnapshot;

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

      const participantsData: ParticipantTableData[] = [];
      let roomCount = 0;
      let participantCount = 0;
      let recordingCount = 0;
      let onlineCount = 0;
      let unAuthCount = 0;
      Object.entries(spaceInfoMap).forEach(([spaceId, spaceInfo]) => {
        if (spaceInfo.participants && Object.keys(spaceInfo.participants).length > 0) {
          roomCount++;
          if (spaceInfo.isRecording) {
            recordingCount++;
          }

          Object.entries(spaceInfo.participants).forEach(
            ([participantId, participant]) => {
              participantCount++;
              if (participant.online) {
                onlineCount++;
              }

              if (participant.isGuest) {
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
                isOwner: participant.isOwner,
                isRecording: spaceInfo.isRecording || false,
                virtualEnabled: participant.virtualEnabled,
                during: duringDisplay,
                online: participant.online,
                isAuth: participant.isAuth,
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

    // History stats aggregation
    const allUsers = new Set<string>();
    const platformUsers = new Set<string>();
    let totalDurationAll = 0;

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

          // Aggregate for history stats
          allUsers.add(participantName);
          totalDurationAll += totalDuration;
          // Check if user is a platform user (contains platform identifier)
          if (participantName.startsWith('platform_') || participantName.includes('@')) {
            platformUsers.add(participantName);
          }
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

    // Set history stats
    const totalRooms = Object.keys(records).length;
    const totalUsers = allUsers.size;
    const platformUserCount = platformUsers.size;
    const avgDuration =
      totalUsers > 0
        ? `${Math.floor(totalDurationAll / totalUsers / 3600000)}h ${Math.floor(
          ((totalDurationAll / totalUsers) % 3600000) / 60000,
        )}m`
        : '0h 0m';

    setHistoryTotalRooms(totalRooms);
    setHistoryTotalUsers(totalUsers);
    setHistoryPlatformUsers(platformUserCount);
    setHistoryAvgDuration(avgDuration);
  };
  const refreshData = useLatestCallback(fetchAllData);
  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;

    const loadDashboard = async () => {
      const nextConf = await getConf().catch(() => null);
      if (cancelled || nextConf?.initialized === false) {
        return;
      }

      await refreshData();
      if (cancelled) return;

      apiFetch('/api/webhook/status')
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return;
          setWebhookEnabled(data.webhook);
          setLicenseManageVisible(data.webhook);
        })
        .catch(() => {
          if (cancelled) return;
          setWebhookEnabled(false);
          setLicenseManageVisible(false);
        });

      interval = setInterval(() => {
        void refreshData();
      }, 120000);
    };

    void loadDashboard().catch(error => console.error('Dashboard initialization failed', error));

    return () => {
      cancelled = true;
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [getConf, refreshData, setWebhookEnabled, setLicenseManageVisible]);
  return { ...context, fetchAllData, processHistoryData };
}
