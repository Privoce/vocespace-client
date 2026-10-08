import { ScrollView, Text, View } from 'react-native';
import { ui } from '../theme';

export function MessagesScreen() {
  return (
    <ScrollView contentContainerStyle={ui.page}>
      <Text style={ui.eyebrow}>MESSAGES</Text>
      <Text style={ui.title}>消息</Text>
      <View style={ui.card}>
        <Text style={ui.subtitle}>把交流留给当下</Text>
        <Text style={ui.body}>消息中心将在后续开放。目前暂不提供私信。</Text>
      </View>
    </ScrollView>
  );
}
