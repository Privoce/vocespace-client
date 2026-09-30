'use client';
import * as React from 'react';
import { useWidgets } from '@/components/Widgets/hooks/useWidgets';
import { FlotLayoutPC } from '@/features/widgets/views/pc';
import { FlotLayoutPhone } from '@/features/widgets/views/phone';
import { FlotLayoutProps, FlotLayoutExports } from '@/components/Widgets/item';
export * from '@/components/Widgets/item';
export const FlotLayout = React.forwardRef<FlotLayoutExports, FlotLayoutProps>(function FlotLayout(props, ref) {
const model = useWidgets(props, ref);
return <FlotLayoutPC model={model} />;
});
