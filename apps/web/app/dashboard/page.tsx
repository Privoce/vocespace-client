'use client';
import * as React from 'react';
import { useDashboard } from '@/app/dashboard/hooks/useDashboard';
import { DashboardSurface } from '@/app/dashboard/views/surface';
import {  } from '@/app/dashboard/shared';

export default function Dashboard() {
const model = useDashboard();
return <DashboardSurface model={model} />;
}
