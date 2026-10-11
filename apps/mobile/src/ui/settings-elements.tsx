import { Children, createContext, useContext, type CSSProperties, type ReactNode } from 'react';
import {
  Linking,
  Text,
  View,
  Pressable,
  ScrollView,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import type { SettingsElements } from '@vocespace/ui';

const TextTheme = createContext<TextStyle>({ color: '#AAAAAA', fontSize: 14, lineHeight: 22 });
const classStyles: Record<string, ViewStyle> = {
  setting_box: { marginTop: 16, marginBottom: 0, width: '100%' },
  setting_box_line: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  selected_mask: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#22CCEE',
    zIndex: 1,
  },
  common_space: { marginVertical: 6 },
  scroll_box: {},
  virtual_model_box: {
    width: '29%',
    height: 120,
    backgroundColor: '#000',
    borderRadius: 8,
    overflow: 'hidden',
  },
  virtual_settings: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    width: '100%',
    flexWrap: 'wrap',
  },
  card: {
    padding: 16,
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ffffff12',
  },
  virtual_video_box: {
    height: 220,
    width: '100%',
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
  },
};
export const settingsStyleNames = Object.fromEntries(
  Object.keys(classStyles).map((name) => [name, name]),
);
function length(value: unknown) {
  if (value === 'calc(50% - 8px)') return '48%';
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && /^-?[\d.]+px$/.test(value)) return Number(value.slice(0, -2));
  if (typeof value === 'string' && /^-?[\d.]+%$/.test(value)) return value;
  return undefined;
}
/** Converts only the small, explicit inline style vocabulary of the shared Phone templates. */
function presentation(style: CSSProperties = {}) {
  const view: Record<string, unknown> = {};
  const text: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(style)) {
    if (['color', 'fontWeight', 'textAlign', 'textDecorationLine', 'fontStyle'].includes(key))
      text[key] = value;
    else if (key === 'display' && value === 'grid') {
      view.flexDirection = 'row';
      view.flexWrap = 'wrap';
    } else if (key === 'background') view.backgroundColor = value;
    else if (key === 'fontSize') {
      text[key] = length(value);
      if (typeof text[key] === 'number' && style.lineHeight === undefined)
        text.lineHeight = (Number(text[key]) * 22) / 14;
    } else if (key === 'lineHeight' && typeof value === 'number') {
      text.lineHeight = value < 4 ? (Number(length(style.fontSize)) || 14) * value : value;
    } else if (
      [
        'alignItems',
        'justifyContent',
        'flexWrap',
        'flexDirection',
        'backgroundColor',
        'overflow',
        'opacity',
        'flex',
        'flexShrink',
      ].includes(key)
    )
      view[key] = value;
    else if (
      [
        'width',
        'height',
        'minHeight',
        'minWidth',
        'borderRadius',
        'gap',
        'marginTop',
        'marginBottom',
        'marginLeft',
        'marginRight',
        'paddingTop',
        'paddingBottom',
        'paddingLeft',
        'paddingRight',
      ].includes(key)
    )
      view[key] = length(value);
    else if (key === 'display' && (value === 'flex' || value === 'inline-flex'))
      view.flexDirection = style.flexDirection ?? 'row';
    else if ((key === 'margin' || key === 'padding') && typeof value === 'number')
      view[key] = value;
    else if ((key === 'margin' || key === 'padding') && typeof value === 'string') {
      const [vertical, horizontal = vertical] = value.split(' ');
      view[`${key}Vertical`] = parseFloat(vertical);
      view[`${key}Horizontal`] = parseFloat(horizontal);
    } else if (key === 'border' && typeof value === 'string') {
      const [width, , color] = value.split(' ');
      view.borderWidth = parseFloat(width);
      view.borderColor = color;
    }
  }
  return { view: view as ViewStyle, text: text as TextStyle };
}
function SettingsDiv({
  children,
  className,
  style,
}: {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const inherited = useContext(TextTheme);
  const converted = presentation(style);
  const text = { ...inherited, ...converted.text };
  // An inline textual paragraph remains one Text node, so links flow with its text.
  const values = Children.toArray(children);
  const paragraph = values.some((value) => typeof value === 'string' || typeof value === 'number');
  if (style?.overflowY === 'auto') {
    const { gap, ...scrollStyle } = converted.view;
    return (
      <TextTheme.Provider value={text}>
        <ScrollView nestedScrollEnabled style={scrollStyle} contentContainerStyle={{ gap }}>
          {children}
        </ScrollView>
      </TextTheme.Provider>
    );
  }
  return (
    <TextTheme.Provider value={text}>
      <View
        style={[...(className?.split(' ').map((name) => classStyles[name]) ?? []), converted.view]}
      >
        {paragraph ? <Text style={text}>{children}</Text> : children}
      </View>
    </TextTheme.Provider>
  );
}
function SettingsSpan({ children, style }: { children?: ReactNode; style?: CSSProperties }) {
  const inherited = useContext(TextTheme);
  return <Text style={[inherited, presentation(style).text]}>{children}</Text>;
}
export function createSettingsElements(onLinkError: () => void): SettingsElements {
  return {
    Heading4: ({ children }) => (
      <Text style={{ color: '#aaa', fontSize: 14, fontWeight: '700', marginVertical: 18.6 }}>
        {children}
      </Text>
    ),
    Clickable: ({ children, className, onClick }) => (
      <Pressable
        disabled={!onClick}
        accessibilityState={{ disabled: !onClick }}
        onPress={onClick}
        style={className?.split(' ').map((name) => classStyles[name])}
      >
        {children}
      </Pressable>
    ),
    Article: SettingsDiv,
    Bold: ({ children }) => <SettingsSpan style={{ fontWeight: 700 }}>{children}</SettingsSpan>,
    Break: () => <Text>{'\n'}</Text>,
    Div: SettingsDiv,
    Span: SettingsSpan,
    Strong: ({ children, style }) => (
      <SettingsSpan style={{ fontWeight: 600, ...style }}>{children}</SettingsSpan>
    ),
    Flex: ({ children, justify, align, style }) => (
      <SettingsDiv
        style={{ display: 'flex', justifyContent: justify, alignItems: align, ...style }}
      >
        {children}
      </SettingsDiv>
    ),
    Link: ({ children, href, style }) => (
      <Text
        accessibilityRole="link"
        style={presentation(style).text}
        onPress={() => {
          void Linking.openURL(href).catch(onLinkError);
        }}
      >
        {children}
      </Text>
    ),
  };
}
