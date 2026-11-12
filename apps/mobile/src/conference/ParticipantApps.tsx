import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { MeetingAppsPanel, type MeetingAppsPanelProps } from '@vocespace/ui';
import type { NativeRoomDirectory, NativeWidgetTodo, NativeWidgetKey } from '@vocespace/contracts';
import { useI18n } from '../i18n';
import type { NativeRoom } from './room';
import { useParticipantWidgets } from './hooks/useParticipantWidgets';
import {
  WidgetClock,
  WidgetIcon,
  WidgetTodoActions,
  WidgetTodos,
  widgetStyles as s,
} from './widgets/WidgetContent';

export function ParticipantApps({
  room,
  identity,
  directory,
  configuredApps,
}: {
  room: NativeRoom;
  identity: string;
  directory?: NativeRoomDirectory;
  configuredApps?: NativeWidgetKey[];
}) {
  const { t } = useI18n();
  const own = identity === room.raw.localParticipant.identity;
  const model = useParticipantWidgets(room, own);
  const [active, setActive] = useState('todo');
  const [expanded, setExpanded] = useState<string>();
  const member = directory?.participants?.[identity];
  const shared = member?.apps;
  const todos: NativeWidgetTodo[] = own
    ? model.data?.todo.flatMap((group) => group.items) || []
    : (shared?.todo || []).map((item) => ({
        ...item,
        done: item.done ? 1 : undefined,
        visible: true,
      }));
  const enabled = own
    ? model.data?.enabled || configuredApps || Object.keys(shared || {})
    : Object.keys(shared || {});
  const unavailable = (
    <View style={s.body}>
      <Text style={s.muted}>
        {t(model.error ? 'native_settings.unknown' : 'shared_meeting.apps_loading')}
      </Text>
    </View>
  );
  const currentRoom = directory?.rooms.find((entry) => entry.name === directory.current);
  const team = Object.entries(directory?.participants || {}).filter(
    ([id, value]) =>
      currentRoom?.participantIds.includes(id) &&
      (value.apps?.todo !== undefined || (own && id === identity)),
  );
  const syncAction = (key: 'todo' | 'timer' | 'countdown') =>
    own &&
    model.data && (
      <WidgetIcon
        icon={model.data.sync.includes(key) ? 'eye' : 'eye-invisible'}
        label={t(
          model.data.sync.includes(key)
            ? 'more.app.settings.sync.desc_priv'
            : 'more.app.settings.sync.desc_pub',
        )}
        disabled={model.busy}
        onPress={() =>
          void model.update({ kind: 'sync', key, visible: !model.data!.sync.includes(key) })
        }
      />
    );
  const tabs: MeetingAppsPanelProps['tabs'] = [];
  if (enabled.includes('todo'))
    tabs.push({
      id: 'todo',
      label: t('more.app.todo.title'),
      actions: (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {syncAction('todo')}
          {own && model.data && <WidgetTodoActions todos={todos} t={t} />}
        </View>
      ),
      content:
        own && !model.data ? (
          unavailable
        ) : (
          <WidgetTodos
            todos={todos}
            t={t}
            busy={model.busy}
            update={own ? model.update : undefined}
          />
        ),
    });
  if (own)
    tabs.push({
      id: 'together',
      label: t('more.app.todo.together.title'),
      content: (
        <View style={s.body}>
          {!team.length && <Text style={s.muted}>{t('more.app.todo.together.empty')}</Text>}
          {team.map(([id, value]) => {
            const list =
              own && id === identity
                ? todos.filter((item) => item.visible)
                : value.apps?.todo || [];
            const done = list.filter((item) => item.done).length;
            return (
              <View key={id}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={value.name}
                  accessibilityState={{ expanded: expanded === id }}
                  onPress={() => setExpanded(expanded === id ? undefined : id)}
                >
                  <Text style={s.text}>{value.name}</Text>
                  <Text style={s.muted}>{list[0]?.title || t('more.app.todo.together.empty')}</Text>
                  <View
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}
                  >
                    <View style={{ height: 5, backgroundColor: '#333', flex: 1 }}>
                      <View
                        style={{
                          height: 5,
                          backgroundColor: '#22CCEE',
                          width: `${list.length ? (done / list.length) * 100 : 0}%`,
                        }}
                      />
                    </View>
                    <Text style={s.text}>
                      {done}/{list.length}
                    </Text>
                  </View>
                </Pressable>
                {expanded === id && (
                  <WidgetTodos
                    t={t}
                    todos={list.map((item) => ({
                      ...item,
                      done: typeof item.done === 'number' ? item.done : item.done ? 1 : undefined,
                      visible: true,
                    }))}
                  />
                )}
              </View>
            );
          })}
        </View>
      ),
    });
  for (const key of ['timer', 'countdown'] as const) {
    const data = own ? model.data?.[key] : shared?.[key];
    if (enabled.includes(key))
      tabs.push({
        id: key,
        label: t(`more.app.${key}.title`),
        actions: syncAction(key),
        content: data ? (
          <WidgetClock
            kind={key}
            data={data}
            t={t}
            update={own ? model.update : undefined}
            busy={model.busy}
          />
        ) : (
          unavailable
        ),
      });
  }
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      {own && model.error && (
        <Text accessibilityRole="alert" style={{ color: '#ff9898', marginBottom: 12 }}>
          {t('shared_meeting.apps_error')}
        </Text>
      )}
      <MeetingAppsPanel
        name={model.data?.name || member?.name}
        tabs={tabs}
        active={active}
        onChange={setActive}
      />
    </ScrollView>
  );
}
