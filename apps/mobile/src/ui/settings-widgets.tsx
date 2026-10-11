import { useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { PhoneSettingsButton as Button, PhoneSettingsInput as Input } from './settings';
import { MeetingSettingsRange } from './meeting';
import { useI18n } from '../i18n';
import { Switch, IconOutline } from './controls';
export { Button, Input };
export function SettingsNote({ children }: { children: ReactNode }) {
  return (
    <Text style={{ color: '#8E99AB', fontSize: 12, lineHeight: 18, marginVertical: 8 }}>
      {children}
    </Text>
  );
}
export function SettingsChoice({
  value,
  options,
  onChange,
  disabled = false,
  vertical = false,
  compact = false,
  size = 'large',
}: {
  value?: string | boolean;
  options: readonly { value: string | boolean; label: string; disabled?: boolean }[];
  onChange?: (value: string | boolean) => void;
  disabled?: boolean;
  vertical?: boolean;
  compact?: boolean;
  size?: 'small' | 'default' | 'large';
}) {
  return (
    <View
      style={{
        flexDirection: vertical ? 'column' : 'row',
        marginVertical: 6,
        width: compact ? 150 : '100%',
      }}
    >
      {options.map((option, index) => (
        <Button
          key={String(option.value)}
          appearance="option"
          size={size}
          position={
            vertical || options.length === 1
              ? undefined
              : index === 0
                ? 'first'
                : index === options.length - 1
                  ? 'last'
                  : 'middle'
          }
          active={value === option.value}
          disabled={disabled || option.disabled}
          onPress={() => onChange?.(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </View>
  );
}
export function SettingsToggle({
  value,
  onChange,
  disabled = false,
}: {
  value?: boolean;
  onChange?: (value: boolean) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  return (
    <SettingsChoice
      value={value}
      options={[
        { value: true, label: t('common.open') },
        { value: false, label: t('common.close') },
      ]}
      disabled={disabled}
      onChange={(v) => {
        if (typeof v === 'boolean') onChange?.(v);
      }}
    />
  );
}
export function SettingsSelect({
  value,
  options,
  onChange,
  disabled = false,
  label,
  icon,
}: {
  value?: string;
  options: readonly { value: string; label: string }[];
  onChange?: (value: string) => void;
  disabled?: boolean;
  label: string;
  icon?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={{
          borderWidth: 1,
          borderColor: disabled ? '#333' : '#22CCEE',
          borderRadius: 4,
          minHeight: 40,
          backgroundColor: '#1E1E1E',
          paddingHorizontal: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginVertical: 6,
        }}
      >
        {icon}
        <Text style={{ flex: 1, color: disabled ? '#777' : '#E7EDF5', fontSize: 16 }}>
          {options.find((o) => o.value === value)?.label ?? t('native_settings.unknown')}
        </Text>
        <IconOutline name="down" size={12} color={disabled ? '#333' : '#fff'} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#0009' }}>
          <View
            style={{
              backgroundColor: '#1E1E1E',
              borderRadius: 12,
              padding: 16,
              maxHeight: '80%',
              gap: 8,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>{label}</Text>
            <ScrollView>
              {options.map((option) => (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: option.value === value }}
                  onPress={() => {
                    onChange?.(option.value);
                    setOpen(false);
                  }}
                  style={{ paddingVertical: 14 }}
                >
                  <Text
                    style={{ fontSize: 16, color: option.value === value ? '#22CCEE' : '#E7EDF5' }}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Button onPress={() => setOpen(false)}>{t('common.cancel')}</Button>
          </View>
        </View>
      </Modal>
    </>
  );
}
export function SettingsSlider({
  value,
  min = 0,
  max = 100,
  step = 1,
  label,
  disabled = true,
  onChange,
}: {
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  label: string;
  disabled?: boolean;
  onChange?: (v: number) => void;
}) {
  const { t } = useI18n();
  if (value === undefined) return <SettingsNote>{t('native_settings.unknown')}</SettingsNote>;
  return (
    <View style={{ marginVertical: 6 }}>
      <MeetingSettingsRange
        label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(v) => onChange?.(v)}
      />
    </View>
  );
}
export function SettingsPermissionTable({
  permissions,
  disabled = true,
  onChange,
}: {
  permissions?: Record<string, Record<string, boolean>>;
  disabled?: boolean;
  onChange?: (value: Record<string, Record<string, boolean>>) => void;
}) {
  const { t } = useI18n();
  const roles = ['owner', 'manager', 'participant', 'guest'];
  const cells = {
    padding: 12,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#303030',
    justifyContent: 'center' as const,
  };
  return (
    <ScrollView horizontal>
      <View style={{ borderLeftWidth: 1, borderTopWidth: 1, borderColor: '#303030' }}>
        <View style={{ flexDirection: 'row' }}>
          {['RBAC', 'Owner', 'Manager', 'Participant', 'Guest'].map((name, i) => (
            <View
              key={name}
              style={[
                cells,
                { width: i === 0 ? 140 : i === 3 ? 120 : 100, backgroundColor: '#1E1E1E' },
              ]}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>{name}</Text>
            </View>
          ))}
        </View>
        {[
          'viewRoom',
          'createRoom',
          'manageRoom',
          'manageRole',
          'controlUser',
          'recording',
          'manageFile',
          'managePlayer',
        ].map((key) => (
          <View key={key} style={{ flexDirection: 'row' }}>
            <View style={[cells, { width: 140 }]}>
              <Text style={{ color: '#E7EDF5' }}>{t(`auth.${key}`)}</Text>
            </View>
            {roles.map((role, i) => (
              <View key={role} style={[cells, { width: i === 2 ? 120 : 100 }]}>
                {permissions ? (
                  <Switch
                    checked={permissions[role]?.[key] ?? false}
                    disabled={disabled}
                    onChange={(value) =>
                      onChange?.({ ...permissions, [role]: { ...permissions[role], [key]: value } })
                    }
                    accessibilityLabel={`${role} ${t(`auth.${key}`)}`}
                  />
                ) : (
                  <Text style={{ color: '#777' }}>—</Text>
                )}
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
export function SettingsDialog({
  open,
  title,
  children,
  onClose,
  onConfirm,
  confirmLabel,
  disabled = false,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  onConfirm?: () => void;
  confirmLabel: string;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: '#0008', padding: 16 }}>
        <View
          style={{
            backgroundColor: '#1E1E1E',
            borderRadius: 8,
            padding: 24,
            gap: 16,
            maxHeight: '85%',
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>{title}</Text>
          <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
            <Button onPress={onClose}>{t('common.cancel')}</Button>
            <Button active disabled={disabled || !onConfirm} onPress={onConfirm}>
              {confirmLabel}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}
