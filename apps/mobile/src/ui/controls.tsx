import type { ComponentProps } from 'react';
import { View, type AccessibilityProps } from 'react-native';
import TabBar from '@ant-design/react-native/lib/tab-bar';
import AntButton, { type ButtonProps } from '@ant-design/react-native/lib/button';
import AntInput from '@ant-design/react-native/lib/input/Input';
import type { InputProps } from '@ant-design/react-native/lib/input/PropsType';
import AntSwitch from '@ant-design/react-native/lib/switch';
import type { SwitchProps } from '@ant-design/react-native/lib/switch/Switch';
import { colors, primaryButtonStyles, ui } from '../theme';

// Explicit component imports keep unused legacy components out of the Native bundle.
export { default as AntProvider } from '@ant-design/react-native/lib/provider';
export { TabBar };
export { IconOutline, IconFill } from '@ant-design/icons-react-native';

export function PrimaryButton(props: ButtonProps) {
  return <AntButton type="primary" styles={primaryButtonStyles} {...props} />;
}
export function Input(props: Omit<InputProps, 'children'>) {
  return (
    <AntInput
      placeholderTextColor={colors.muted}
      style={ui.input}
      inputStyle={ui.inputText}
      {...props}
    />
  );
}
export function Switch(props: SwitchProps & AccessibilityProps) {
  return <AntSwitch color={colors.accent} {...props} />;
}
export function TabItem(props: ComponentProps<typeof TabBar.Item>) {
  return (
    <View
      style={{ flex: 1 }}
      accessible
      accessibilityRole="tab"
      accessibilityLabel={props.title}
      accessibilityState={{ selected: props.selected }}
      onAccessibilityTap={props.onPress}
    >
      <TabBar.Item {...props} />
    </View>
  );
}
