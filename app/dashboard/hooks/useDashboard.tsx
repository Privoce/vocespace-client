'use client';

import { useDashboardActions } from './useDashboardActions';
import { useDashboardData } from './useDashboardData';
import { useDashboardState } from './useDashboardState';
export function useDashboard() {
  const part0 = useDashboardState();
  const part1 = useDashboardData(part0);
  const part2 = useDashboardActions(part1);
  return part2;
}
