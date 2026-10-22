import type { MeetingButtonProps } from './types';

/** Matches Web ConfigProvider and the established Web Phone meeting controls. */
export const phoneButtonColors = {
  primary: '#22CCEE',
  primaryText: '#FFFFFF',
  primaryPressed: '#06AED4',
  defaultText: '#8c8c8c',
  defaultBorder: '#d9d9d9',
  defaultBackground: '#ffffff',
  disabledText: '#333333',
  disabledBackground: 'rgba(0,0,0,0.04)',
  selectedText: '#22CCEE',
  optionBackground: '#1A2832',
  optionBorder: '#304753',
  optionText: '#DBE6EC',
} as const;
export function meetingButtonVisual({
  appearance,
  active,
  disabled,
}: Pick<MeetingButtonProps, 'appearance' | 'active' | 'disabled'>) {
  const control = appearance === 'control' || appearance === 'controlDanger';
  const circle = appearance === 'circle' || appearance === 'danger' || appearance === 'icon';
  return {
    backgroundColor:
      appearance === 'icon' || appearance === 'row'
        ? 'transparent'
        : appearance === 'danger' || appearance === 'controlDanger'
          ? '#24171A'
          : active || appearance === 'primary'
            ? circle || control
              ? '#153B46'
              : phoneButtonColors.primary
            : '#1A2832',
    borderColor:
      appearance === 'danger' || appearance === 'controlDanger' || appearance === 'destructive'
        ? '#FF4D4F'
        : active || appearance === 'primary'
          ? phoneButtonColors.primary
          : '#FFFFFF16',
    borderWidth: appearance === 'icon' || appearance === 'row' ? 0 : 1,
    color: disabled ? '#66707A' : '#E7EDF5',
  };
}
