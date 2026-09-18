'use client';
import * as React from 'react';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { SettingsSurface } from '@/features/settings/views/surface';
import { SettingsProps, SettingsExports } from '@/features/settings/shared';
export * from '@/features/settings/shared';
export const Settings = React.forwardRef<SettingsExports, SettingsProps>(function Settings(props, ref) {
const model = useSettings(props, ref);
return <SettingsSurface model={model} />;
});
