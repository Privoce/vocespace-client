import type { NativeSettingsSnapshot } from '@vocespace/contracts';
import { SettingsIcon } from '../../ui/SettingsIcon';
import { Fragment, useState } from 'react';
import { Image, Pressable, Text, View, type ImageSourcePropType } from 'react-native';
import {
  SettingsSelectedMask,
  VirtualSettingsContent,
  VirtualGalleryContent,
  VirtualGalleryItem,
  virtualModels,
  virtualBackgrounds,
  type SettingsViewProps,
} from '@vocespace/ui';
import { SettingsNote } from '../../ui/settings-widgets';
const images: Record<string, ImageSourcePropType> = {
  'Haru.png': require('../../../assets/settings/models/Haru.png'),
  'Hiyori.png': require('../../../assets/settings/models/Hiyori.png'),
  'Mao.png': require('../../../assets/settings/models/Mao.png'),
  'Mark.png': require('../../../assets/settings/models/Mark.png'),
  'Natori.png': require('../../../assets/settings/models/Natori.png'),
  'Rice.png': require('../../../assets/settings/models/Rice.png'),
  'v_bg1.png': require('../../../assets/settings/bg/v_bg1.png'),
  'v_bg2.jpg': require('../../../assets/settings/bg/v_bg2.jpg'),
  'v_bg3.jpg': require('../../../assets/settings/bg/v_bg3.jpg'),
  'v_bg4.jpg': require('../../../assets/settings/bg/v_bg4.jpg'),
  'v_bg5.jpg': require('../../../assets/settings/bg/v_bg5.jpg'),
};
export function VirtualSettings({
  common,
  selected,
  disabled,
  onSave,
}: {
  common: SettingsViewProps;
  selected?: NativeSettingsSnapshot['virtual'];
  disabled: boolean;
  onSave: (value: NativeSettingsSnapshot['virtual']) => void;
}) {
  const { t } = common;
  const [tab, setTab] = useState<'model' | 'background'>('model');
  return VirtualSettingsContent({
    ...common,
    slots: {
      preview: (
        <View style={{ flex: 1, justifyContent: 'center', padding: 16 }}>
          <SettingsNote>{t('native_settings.video_preferences_hint')}</SettingsNote>
        </View>
      ),
      tabs: (
        <View style={{ width: '100%' }}>
          <View
            style={{ flexDirection: 'row', gap: 24, borderBottomWidth: 1, borderColor: '#333' }}
          >
            {(['model', 'background'] as const).map((value) => (
              <Pressable
                key={value}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === value }}
                onPress={() => setTab(value)}
                style={{
                  paddingVertical: 12,
                  borderBottomWidth: 2,
                  borderColor: tab === value ? '#22CCEE' : 'transparent',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <SettingsIcon name={value === 'model' ? 'model' : 'bg'} />
                  <Text style={{ color: tab === value ? '#22CCEE' : '#fff' }}>
                    {t(`settings.virtual.tab.${value}`)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
          {VirtualGalleryContent({
            ...common,
            title: t(`settings.virtual.${tab}`),
            children: (tab === 'model' ? virtualModels : virtualBackgrounds).map((item) => (
              <Fragment key={item.src}>
                {VirtualGalleryItem({
                  ...common,
                  onSelect:
                    disabled || !selected
                      ? undefined
                      : () =>
                          onSave(
                            tab === 'model'
                              ? { ...selected, role: item.name, enabled: item.name !== 'None' }
                              : { ...selected, bg: item.src },
                          ),
                  selected: (
                    tab === 'model' ? selected?.role === item.name : selected?.bg === item.src
                  )
                    ? SettingsSelectedMask({
                        ...common,
                        icon: <SettingsIcon name="check" size={24} color="#22CCEE" />,
                      })
                    : null,
                  noneLabel: item.name === 'None' ? t('settings.virtual.none') : undefined,
                  preview: (
                    <Image
                      accessibilityLabel={item.name}
                      source={images[item.src]}
                      resizeMode="cover"
                      style={{ width: '100%', height: 120 }}
                    />
                  ),
                })}
              </Fragment>
            )),
          })}
        </View>
      ),
    },
  });
}
