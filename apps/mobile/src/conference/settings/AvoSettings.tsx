import type { NativeAvoPreference } from '@vocespace/contracts';
import { useAvoDrafts, type AvoDraft } from './useAvoDrafts';
import { Pressable, Text, View } from 'react-native';
import {
  avoStyles,
  avoPalette,
  AvoPhoneContent,
  AvoPresetsContent,
  AvoPresetContent,
  type SettingsViewProps,
} from '@vocespace/ui';
import {
  Button,
  Input,
  SettingsChoice,
  SettingsNote,
  SettingsSlider,
} from '../../ui/settings-widgets';
import { IconOutline } from '../../ui/controls';
import { MeetingAvo } from '../../ui/MeetingAvo';

function AvoPreview({
  value,
  small = false,
  active = false,
}: {
  value: AvoDraft;
  small?: boolean;
  active?: boolean;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#1E1E1E',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View style={{ width: small ? 48 : 180, height: small ? 48 : 180 }}>
        <MeetingAvo avo={{ ...value, isUsed: true }} animate={active && !small} />
      </View>
    </View>
  );
}
/** Drafts stay local until an explicit save/load/delete succeeds through the settings API. */
export function AvoSettings({
  common,
  name,
  presets,
  disabled,
  onSave,
  active = false,
}: {
  active?: boolean;
  common: SettingsViewProps;
  name: string;
  presets?: NativeAvoPreference[];
  disabled: boolean;
  onSave: (presets: NativeAvoPreference[]) => Promise<boolean>;
}) {
  const { t } = common;
  const {
    draft,
    drafts: displayedPresets,
    selectedIndex,
    update,
    load,
    reset,
    accept,
  } = useAvoDrafts(name, presets);
  const persist = async (values: NativeAvoPreference[]) => {
    if (await onSave(values)) accept(values);
  };
  return (
    <>
      {AvoPhoneContent({
        ...common,
        slots: {
          preview: <AvoPreview value={draft} active={active} />,
          name: (
            <View style={{ marginTop: 6 }}>
              <Input
                value={draft.name}
                placeholder={name || 'guest'}
                onChangeText={(name) => update({ name })}
              />
            </View>
          ),
          enabled: (
            <SettingsChoice
              compact
              size="default"
              value={draft.enabled}
              options={[
                { value: true, label: t('avo.enabled') },
                { value: false, label: t('avo.disabled') },
              ]}
              onChange={(enabled) => {
                if (typeof enabled === 'boolean') update({ enabled });
              }}
            />
          ),
          style: (
            <SettingsChoice
              size="default"
              value={draft.style}
              options={avoStyles.map((value) => ({ value, label: t(`avo.styles.${value}`) }))}
              onChange={(style) => {
                if (style === 'blob' || style === 'ring' || style === 'wave') update({ style });
              }}
            />
          ),
          palette: avoPalette.map((hue) => (
            <Pressable
              key={hue}
              accessibilityRole="radio"
              accessibilityLabel={`${t('avo.color')} ${hue}`}
              accessibilityState={{ selected: draft.hue === hue }}
              onPress={() => update({ hue })}
              style={{
                height: 42,
                width: 42,
                borderRadius: 999,
                borderWidth: draft.hue === hue ? 2 : 1,
                borderColor: draft.hue === hue ? '#fff' : '#ffffff1f',
                backgroundColor: `hsl(${hue},72%,62%)`,
              }}
            />
          )),
          energy: (
            <SettingsSlider
              label={t('avo.energy')}
              min={0.1}
              max={1}
              step={0.05}
              value={draft.energy}
              disabled={false}
              onChange={(energy) => update({ energy })}
            />
          ),
          shuffle: (
            <Button
              size="default"
              onPress={() =>
                update({
                  variant: Math.floor(Math.random() * 1_000_000),
                  hue: avoPalette[Math.floor(Math.random() * avoPalette.length)],
                  style: avoStyles[Math.floor(Math.random() * avoStyles.length)],
                  energy: Math.round((0.4 + Math.random() * 0.5) * 20) / 20,
                })
              }
            >
              {t('avo.shuffle')}
            </Button>
          ),
          reset: (
            <Button size="default" onPress={reset}>
              {t('avo.reset')}
            </Button>
          ),
          save: (
            <View style={{ width: '100%' }}>
              <Button
                disabled={disabled || displayedPresets.length >= 30}
                size="default"
                onPress={() => {
                  void persist([
                    ...displayedPresets.map((item, index) => ({
                      ...item,
                      variant: item.variant,
                      isUsed: presets?.[index]?.isUsed ?? index === 0,
                    })),
                    { ...draft, isUsed: false },
                  ]);
                }}
              >
                {t('avo.saveAsPreset')}
              </Button>
            </View>
          ),
          export: (
            <Button disabled size="default">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <IconOutline name="download" color="#777" />
                <Text style={{ color: '#777' }}>{t('avo.export')}</Text>
              </View>
            </Button>
          ),
          import: (
            <Button disabled size="default">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <IconOutline name="upload" color="#777" />
                <Text style={{ color: '#777' }}>{t('avo.import')}</Text>
              </View>
            </Button>
          ),
          presets: AvoPresetsContent({
            ...common,
            children: displayedPresets.map((item, index) => (
              <View key={index}>
                {AvoPresetContent({
                  ...common,
                  active: index === selectedIndex,
                  name: item.name,
                  style: item.style,
                  preview: <AvoPreview value={item} small />,
                  actions: (
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      <Button
                        size="small"
                        disabled={disabled}
                        onPress={() => {
                          load(index);
                          void persist(
                            displayedPresets.map((value, i) => ({
                              ...value,
                              variant: value.variant,
                              isUsed: i === index,
                            })),
                          );
                        }}
                      >
                        {t('avo.load')}
                      </Button>
                      <Button
                        disabled={disabled || displayedPresets.length <= 1}
                        size="small"
                        onPress={() => {
                          void persist(
                            displayedPresets
                              .filter((_, i) => i !== index)
                              .map((item, i) => ({ ...item, isUsed: i === 0 })),
                          );
                        }}
                      >
                        {t('avo.delete')}
                      </Button>
                    </View>
                  ),
                })}
              </View>
            )),
          }),
        },
      })}
      <SettingsNote>{t('native_settings.avo_saved_hint')}</SettingsNote>
    </>
  );
}
