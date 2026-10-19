import { ScrollView, View, Text, StyleSheet } from 'react-native';
import type { MeetingShareProps } from './types';
export function MeetingShare({
  name,
  title,
  description,
  copyLabel,
  onCopy,
  extra,
  Button,
  Icon,
}: MeetingShareProps) {
  return (
    <ScrollView contentContainerStyle={s.body}>
      <View style={s.emblem}>
        <Icon name="link" size={40} color="#22CCEE" />
      </View>
      <Text style={s.title}>{title}</Text>
      <Text style={s.description}>{description}</Text>
      <View style={s.nameBox}>
        <Text style={s.caption}>SPACE NAME</Text>
        <Text selectable style={s.name}>
          {name}
        </Text>
      </View>
      <Button active appearance="plain" label={copyLabel} onPress={onCopy}>
        <View style={s.button}>
          <Icon name="copy" color="#09252D" />
          <Text style={s.buttonText}>{copyLabel}</Text>
        </View>
      </Button>
      {extra}
    </ScrollView>
  );
}
const s = StyleSheet.create({
  body: { padding: 22, gap: 22, alignItems: 'stretch' },
  emblem: {
    width: 90,
    height: 90,
    borderRadius: 26,
    backgroundColor: '#15343F',
    borderWidth: 1,
    borderColor: '#285565',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 10,
  },
  title: { color: '#E8EFF3', fontSize: 21, fontWeight: '600', textAlign: 'center', marginTop: 6 },
  description: { color: '#829EAE', textAlign: 'center', fontSize: 14, lineHeight: 22 },
  nameBox: {
    padding: 22,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#376173',
    backgroundColor: '#1B303B',
    borderRadius: 14,
    alignItems: 'center',
    gap: 10,
  },
  caption: { color: '#7FA6B8', fontSize: 10, letterSpacing: 3 },
  name: { color: '#B8DAE7', fontSize: 28, letterSpacing: 3 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 12,
  },
  buttonText: { color: '#09252D', fontSize: 15, fontWeight: '600' },
});
