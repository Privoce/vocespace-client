import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconOutline, type OutlineGlyphMapType } from '@ant-design/icons-react-native';
import type { NativeWidgetAction, NativeWidgetTodo, NativeWidgets } from '@vocespace/contracts';
import { Input } from '../../ui/controls';

export type Translate = (key: string) => string;
export type UpdateWidget = (action: NativeWidgetAction) => Promise<boolean>;
export function WidgetIcon({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: OutlineGlyphMapType;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[s.icon, disabled && { opacity: 0.4 }]}
    >
      <IconOutline name={icon} color="#b9c7ce" size={18} />
    </Pressable>
  );
}
export const clockText = (seconds: number) =>
  [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
export function durationSeconds(duration?: string | null) {
  const date = duration ? new Date(duration) : undefined;
  return date && Number.isFinite(date.getTime())
    ? date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds()
    : 300;
}
function Divider({ title }: { title: string }) {
  return (
    <View style={s.divider}>
      <View style={s.line} />
      <Text style={s.muted}>{title}</Text>
      <View style={s.line} />
    </View>
  );
}
export function WidgetTodos({
  todos,
  update,
  busy,
  t,
}: {
  todos: NativeWidgetTodo[];
  update?: UpdateWidget;
  busy?: boolean;
  t: Translate;
}) {
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<string>();
  const [edit, setEdit] = useState('');
  const [pendingId, setPendingId] = useState<string>();
  const today = Math.floor(Date.now() / 86400000) * 86400000;
  const done = todos.filter((item) => item.done && item.done >= today);
  const visible = todos.filter((item) => item.visible);
  const add = async () => {
    if (!draft.trim() || !update || busy) return;
    const id = pendingId || String(Date.now());
    setPendingId(id);
    if (await update({ kind: 'todo-add', id, title: draft.trim() })) {
      setDraft('');
      setPendingId(undefined);
    }
  };
  const row = (item: NativeWidgetTodo, editable: boolean) => (
    <View key={item.id} style={s.todoRow}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={item.title}
        accessibilityState={{ checked: !!item.done, disabled: !update || busy }}
        disabled={!update || busy}
        style={s.checkbox}
        onPress={() => void update?.({ kind: 'todo-done', id: item.id, done: !item.done })}
      >
        <IconOutline name={item.done ? 'check-square' : 'border'} size={19} color="#22CCEE" />
      </Pressable>
      {editing === item.id && editable ? (
        <View style={{ flex: 1 }}>
          <Input
            value={edit}
            onChangeText={setEdit}
            accessibilityLabel={t('more.app.todo.placeholder')}
            onSubmitEditing={() => {
              if (edit.trim() && update)
                void update({ kind: 'todo-edit', id: item.id, title: edit.trim() }).then(
                  (saved) => {
                    if (saved) setEditing(undefined);
                  },
                );
            }}
            editable={!busy}
          />
        </View>
      ) : (
        <Pressable
          style={{ flex: 1 }}
          disabled={!update || busy || !editable}
          accessibilityLabel={item.title}
          onPress={() => {
            setEditing(item.id);
            setEdit(item.title);
          }}
        >
          <Text style={[s.text, !!item.done && s.done]}>{item.title}</Text>
        </Pressable>
      )}
      {!!update && editable && (
        <WidgetIcon
          icon="close"
          label={t('more.app.todo.delete')}
          disabled={busy}
          onPress={() => void update({ kind: 'todo-delete', id: item.id })}
        />
      )}
    </View>
  );
  return (
    <View style={s.body}>
      <Divider title={t('more.app.todo.today_done')} />
      {done.length ? (
        done.map((item) => row(item, false))
      ) : (
        <Text style={s.muted}>{t('more.app.todo.today_empty')}</Text>
      )}
      <Divider title={t('more.app.todo.history')} />
      {visible.length ? (
        visible.map((item) => row(item, true))
      ) : (
        <Text style={s.muted}>{t('more.app.todo.empty')}</Text>
      )}
      {!!update && (
        <View style={s.add}>
          <View style={{ flex: 1 }}>
            <Input
              value={draft}
              onChangeText={(value) => {
                setDraft(value);
                setPendingId(undefined);
              }}
              placeholder={t('more.app.todo.add')}
              accessibilityLabel={t('more.app.todo.add')}
              editable={!busy}
              maxLength={10000}
              onSubmitEditing={() => void add()}
            />
          </View>
          <WidgetIcon
            icon="plus-circle"
            label={t('more.app.todo.create')}
            disabled={busy || !draft.trim()}
            onPress={() => void add()}
          />
        </View>
      )}
    </View>
  );
}

export function WidgetClock({
  kind,
  data,
  update,
  busy,
  t,
}: {
  kind: 'timer' | 'countdown';
  data: NativeWidgets['timer'] | NativeWidgets['countdown'];
  update?: UpdateWidget;
  busy?: boolean;
  t: Translate;
}) {
  const [now, setNow] = useState(Date.now);
  const finishRetry = useRef(0);
  const duration = 'duration' in data ? data.duration : null;
  const seconds = durationSeconds(duration);
  const [draft, setDraft] = useState(clockText(seconds));
  useEffect(() => setDraft(clockText(seconds)), [seconds]);
  useEffect(() => {
    if (!data.running) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [data.running]);
  const elapsed =
    data.value === null
      ? kind === 'countdown'
        ? seconds * 1000
        : 0
      : kind === 'timer'
        ? (data.running ? now : data.stopTimeStamp || now) - data.value
        : data.value - (data.running ? now : data.stopTimeStamp || now);
  useEffect(() => {
    if (
      kind !== 'countdown' ||
      !update ||
      busy ||
      !data.running ||
      data.value === null ||
      data.value > now ||
      now < finishRetry.current
    )
      return;
    finishRetry.current = now + 10000;
    void update({ kind: 'clock', key: 'countdown', command: 'finish' });
  }, [kind, update, busy, data.running, data.value, now]);
  const parsedDraft = () => {
    if (!/^\d{2}:[0-5]\d:[0-5]\d$/.test(draft)) return undefined;
    const [h, m, sec] = draft.split(':').map(Number);
    const value = h * 3600 + m * 60 + sec;
    return value > 0 && value < 86400 ? value : undefined;
  };
  const send = async (command: 'start' | 'pause' | 'reset' | 'lap') => {
    if (!update || busy) return;
    const value = kind === 'countdown' ? parsedDraft() : seconds;
    if (command === 'start' && kind === 'countdown') {
      if (!value) {
        setDraft(clockText(seconds));
        return;
      }
      if (value !== seconds && !(await update({ kind: 'countdown-set', seconds: value }))) return;
    }
    await update({
      kind: 'clock',
      key: kind,
      command,
      ...(kind === 'countdown' && command === 'start' ? { seconds: value } : {}),
    });
  };
  const saveDuration = () => {
    if (!update || busy || data.running) return;
    const value = parsedDraft();
    if (value && value !== seconds) void update({ kind: 'countdown-set', seconds: value });
    else setDraft(clockText(seconds));
  };
  return (
    <View style={s.body}>
      {kind === 'countdown' && (
        <Input
          value={draft}
          onChangeText={setDraft}
          accessibilityLabel={t('more.app.countdown.placeholder')}
          maxLength={8}
          editable={!!update && !busy && !data.running}
          onSubmitEditing={saveDuration}
        />
      )}
      <Text style={s.clock}>{clockText(Math.floor(Math.max(0, elapsed) / 1000))}</Text>
      <View style={s.controls}>
        {data.value !== null && (
          <WidgetIcon
            icon="reload"
            label={t('shared_meeting.clock_reset')}
            disabled={!update || busy}
            onPress={() => send('reset')}
          />
        )}
        <WidgetIcon
          icon={data.running ? 'pause-circle' : 'play-circle'}
          label={t(data.running ? 'shared_meeting.clock_pause' : 'shared_meeting.clock_start')}
          disabled={!update || busy}
          onPress={() => send(data.running ? 'pause' : 'start')}
        />
        {kind === 'timer' && data.running && (
          <WidgetIcon
            icon="flag"
            label={t('shared_meeting.clock_lap')}
            disabled={!update || busy}
            onPress={() => send('lap')}
          />
        )}
      </View>
      {'records' in data &&
        data.records.map((record, i) => (
          <Text style={s.muted} key={i}>
            {i + 1}. {record}
          </Text>
        ))}
    </View>
  );
}

export function WidgetTodoActions({ todos, t }: { todos: NativeWidgetTodo[]; t: Translate }) {
  const [history, setHistory] = useState(false);
  return (
    <>
      <WidgetIcon
        icon="profile"
        label={t('more.app.todo.complete')}
        onPress={() => setHistory(true)}
      />
      <WidgetIcon
        icon="copy"
        label={t('more.app.todo.copy')}
        onPress={() =>
          void Share.share({
            message:
              todos.map((item) => `- [${item.done ? 'x' : ' '}] ${item.title}`).join('\n') ||
              t('more.app.todo.unexport'),
          }).catch(() => undefined)
        }
      />
      <Modal visible={history} onRequestClose={() => setHistory(false)} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#202020' }}>
          <WidgetIcon icon="close" label={t('common.close')} onPress={() => setHistory(false)} />
          <ScrollView contentContainerStyle={s.body}>
            <Text style={s.text}>{t('more.app.todo.complete')}</Text>
            {todos
              .filter((item) => item.done)
              .map((item) => (
                <View key={item.id} style={s.todoRow}>
                  <Text style={s.text}>{item.title}</Text>
                  <Text style={s.muted}>{new Date(item.done!).toLocaleString()}</Text>
                </View>
              ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}
export const widgetStyles = StyleSheet.create({
  text: { color: '#eee', fontSize: 14 },
  muted: { color: '#999', fontSize: 14 },
  body: { padding: 24, gap: 12 },
});
const s = StyleSheet.create({
  ...widgetStyles,
  icon: { width: 36, height: 40, alignItems: 'center', justifyContent: 'center' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 12 },
  line: { flex: 1, height: 1, backgroundColor: '#333' },
  todoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  checkbox: { minWidth: 28, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  done: { textDecorationLine: 'line-through', color: '#999' },
  add: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  clock: { textAlign: 'center', color: '#eee', fontSize: 24, marginTop: 24 },
});
