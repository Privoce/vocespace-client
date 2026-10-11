import { View, Text, Image, StyleSheet } from 'react-native';
import type { MeetingSettingsFormProps, MeetingSettingsNavigationProps } from './settings-types';

/** State, persistence, permissions and platform-only controls are supplied by the adapter. */
export function MeetingSettingsForm({
  fields,
  Button,
  Input,
  Range,
  variant,
}: MeetingSettingsFormProps) {
  const phone = variant === 'web-phone';
  return (
    <View style={[styles.form, phone && phoneStyles.form]}>
      {fields.map((field) => (
        <View key={field.id} style={[styles.field, phone && phoneStyles.field]}>
          {field.kind !== 'action' && (
            <Text style={[styles.label, phone && phoneStyles.label]}>{field.label}</Text>
          )}
          {field.description ? <Text style={styles.description}>{field.description}</Text> : null}
          {field.kind === 'value' && (
            <Text selectable style={styles.value}>
              {field.value}
            </Text>
          )}
          {field.kind === 'content' && field.content}
          {field.kind === 'action' && (
            <Button
              disabled={field.disabled}
              appearance={field.destructive ? 'destructive' : undefined}
              onPress={field.onPress}
            >
              {field.label}
            </Button>
          )}
          {field.kind === 'input' && (
            <Input
              value={field.value}
              onChangeText={field.onChange}
              placeholder={field.placeholder ?? field.label}
              disabled={field.disabled}
              secure={field.secure}
              multiline={field.multiline}
              onSubmit={() => {}}
            />
          )}
          {field.kind === 'range' &&
            (Range ? (
              <Range {...field} />
            ) : (
              <View style={styles.options}>
                <Button
                  label={`${field.label} −`}
                  disabled={field.disabled || field.value <= field.min}
                  onPress={() =>
                    field.onChange(
                      Math.max(field.min, Number((field.value - field.step).toFixed(4))),
                    )
                  }
                >
                  −
                </Button>
                <Text style={styles.value}>{field.value}</Text>
                <Button
                  label={`${field.label} +`}
                  disabled={field.disabled || field.value >= field.max}
                  onPress={() =>
                    field.onChange(
                      Math.min(field.max, Number((field.value + field.step).toFixed(4))),
                    )
                  }
                >
                  +
                </Button>
              </View>
            ))}
          {field.kind === 'gallery' && (
            <View style={styles.options}>
              {field.options.map((option) => (
                <View key={option.value} style={{ width: 120, gap: 8 }}>
                  {option.color && (
                    <View style={{ height: 40, borderRadius: 20, backgroundColor: option.color }} />
                  )}
                  {option.imageUri && (
                    <Image
                      source={{ uri: option.imageUri }}
                      accessibilityLabel={option.label}
                      style={{ width: 120, height: 100, borderRadius: 8 }}
                      resizeMode="contain"
                    />
                  )}
                  {option.preview}
                  <Button
                    label={`${field.label}: ${option.label}`}
                    active={field.value === option.value}
                    disabled={field.disabled}
                    onPress={() => field.onChange(option.value)}
                  >
                    {option.label}
                  </Button>
                </View>
              ))}
            </View>
          )}
          {field.kind === 'text' && (
            <>
              <Input
                value={field.value}
                onChangeText={field.onChange}
                placeholder={field.placeholder}
                disabled={field.disabled}
                maxLength={field.maxLength}
                focus={field.focus}
                onSubmit={() => {
                  if (!field.disabled) field.onSave();
                }}
              />
              <Button disabled={field.disabled} active onPress={field.onSave}>
                {field.saveLabel}
              </Button>
            </>
          )}
          {field.kind === 'toggle' && (
            <View style={[styles.options, phone && phoneStyles.options]}>
              {[true, false].map((value) => (
                <Button
                  key={String(value)}
                  appearance={phone ? 'option' : undefined}
                  label={`${field.label}: ${value ? field.onLabel : field.offLabel}`}
                  active={field.value === value}
                  disabled={field.disabled}
                  onPress={() => {
                    if (field.value !== value) field.onChange(value);
                  }}
                >
                  {value ? field.onLabel : field.offLabel}
                </Button>
              ))}
            </View>
          )}
          {field.kind === 'choice' && (
            <View style={styles.choices}>
              {field.options.map((option) => (
                <Button
                  key={option.value}
                  label={`${field.label}: ${option.label}`}
                  active={field.value === option.value}
                  disabled={field.disabled || option.disabled}
                  onPress={() => {
                    if (!field.disabled && !option.disabled && field.value !== option.value)
                      field.onChange(option.value);
                  }}
                >
                  {option.label}
                </Button>
              ))}
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

/** Navigation only: panel bodies remain mounted in their stable platform owner. */
export function MeetingSettingsNavigation({
  name,
  spaceName,
  panels,
  activePanel,
  selectedPanel,
  onSelect,
  onBack,
  backLabel,
  Button,
  Icon,
}: MeetingSettingsNavigationProps) {
  if (activePanel)
    return (
      <View style={styles.header}>
        <Button appearance="icon" label={backLabel} onPress={onBack}>
          <Icon name="back" size={20} />
        </Button>
        <Text style={styles.title}>{panels.find((panel) => panel.id === activePanel)?.label}</Text>
      </View>
    );
  const groups = [...new Set(panels.map((panel) => panel.group))];
  return (
    <View style={styles.form}>
      <View style={styles.profile}>
        <View style={styles.avatar}>
          <Text style={styles.initial}>{(name || spaceName).slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={styles.identity}>
          <Text numberOfLines={1} style={styles.title}>
            {name}
          </Text>
          <Text numberOfLines={1} style={styles.description}>
            {spaceName}
          </Text>
        </View>
      </View>
      {groups.map((group) => (
        <View key={group} style={styles.group}>
          {panels
            .filter((panel) => panel.group === group)
            .map((panel) => (
              <Button
                key={panel.id}
                appearance="plain"
                label={panel.label}
                active={selectedPanel === panel.id}
                onPress={() => onSelect(panel.id)}
              >
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>{panel.label}</Text>
                  <Text style={styles.description}>›</Text>
                </View>
              </Button>
            ))}
        </View>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  form: { padding: 16, gap: 20, width: '100%' },
  field: { gap: 10 },
  label: { color: '#E7EDF5', fontSize: 14, fontWeight: '600' },
  description: { color: '#96A5BB', fontSize: 12, lineHeight: 19 },
  value: { color: '#E7EDF5', fontSize: 15, lineHeight: 22 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choices: { gap: 8 },
  header: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: 8 },
  title: { color: '#F1F5FB', fontSize: 16, fontWeight: '600', flexShrink: 1 },
  profile: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#1E252E',
  },
  identity: { flex: 1, gap: 6 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#153B46',
  },
  initial: { color: '#22CCEE', fontSize: 20, fontWeight: '600' },
  group: { gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
    padding: 14,
  },
  rowLabel: { color: '#E7EDF5', fontSize: 14, flex: 1 },
});

// Only Native opts into these values, copied from the established Web Phone panel
// padding, Controller setting_box/common_space and app/layout.tsx typography.
const phoneStyles = StyleSheet.create({
  form: { paddingTop: 12, paddingHorizontal: 16, paddingBottom: 24, gap: 16 },
  field: { gap: 6 },
  label: { color: '#AAAAAA', fontWeight: '400', fontSize: 14 },
  options: { gap: 0, flexWrap: 'nowrap' },
});
