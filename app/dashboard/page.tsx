'use client';
import * as React from 'react';
import { useDashboard } from '@/features/dashboard/hooks/useDashboard';
import { DashboardSurface } from '@/features/dashboard/views/surface';
import {  } from '@/features/dashboard/shared';

export default function Dashboard() {
const model = useDashboard();
return <DashboardSurface model={model} />;
}
