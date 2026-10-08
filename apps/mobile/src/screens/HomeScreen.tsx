import { ScrollView, Text, View } from 'react-native';
import { ui } from '../theme';
import { PrimaryButton } from '../ui/controls';

export function HomeScreen({ openMeetings }: { openMeetings: () => void }) {
  return (
    <ScrollView contentContainerStyle={ui.page}>
      <Text style={ui.eyebrow}>VOCE SPACE</Text>
      <Text style={ui.title}>相聚，从这里开始</Text>
      <Text style={ui.body}>发现正在发生的交流，找到想加入的会议。</Text>
      <View style={ui.card}>
        <Text style={ui.subtitle}>会议广场</Text>
        <Text style={ui.body}>公开会议将出现在这里。先看看，再加入。</Text>
        <PrimaryButton onPress={openMeetings}>去会议看看</PrimaryButton>
      </View>
    </ScrollView>
  );
}
