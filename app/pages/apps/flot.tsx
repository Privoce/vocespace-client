'use client';
import * as React from 'react';
import { useWidgets } from '@/features/widgets/hooks/useWidgets';
import { FlotLayoutPC } from '@/features/widgets/views/pc';
import { FlotLayoutPhone } from '@/features/widgets/views/phone';
import { FlotLayoutProps, FlotLayoutExports } from '@/features/widgets/shared';
export * from '@/features/widgets/shared';
export const FlotLayout = React.forwardRef<FlotLayoutExports, FlotLayoutProps>(function FlotLayout(props, ref) {
const model = useWidgets(props, ref);
return <FlotLayoutPC model={model} />;
});
