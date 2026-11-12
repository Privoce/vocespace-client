import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Modal, Pressable, Text, View, TextInput, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { IconOutline, type OutlineGlyphMapType } from '@ant-design/icons-react-native';
import { MeetingToolFolder } from '@vocespace/ui';
import { ApiError } from '@vocespace/client-sdk';
import { MeetingButton as Button, MeetingIcon } from '../../ui/meeting';
import { pickDocument } from '../../ui/document-picker';
import type { NativeRoom } from '../room';
import type { useConferenceChat } from '../../chat/hooks/useConferenceChat';
import { Whiteboard } from './Whiteboard';

type Player = { id: string; mode: 'image' | 'iframe' | 'hyperbeam' | 'whiteboard'; url?: string };
function toolErrorKey(error: unknown, fallback: string) {
  return error instanceof ApiError && error.code === 'NATIVE_ENDPOINT_REQUIRED'
    ? 'shared_meeting.tools_unavailable'
    : fallback;
}
function parsePlayers(value: unknown): Player[] {
  const list = (value as { players?: unknown })?.players;
  if (
    !Array.isArray(list) ||
    list.some(
      (p) =>
        !p ||
        typeof p.id !== 'string' ||
        !['image', 'iframe', 'hyperbeam', 'whiteboard'].includes(p.mode) ||
        (p.url !== undefined && typeof p.url !== 'string'),
    )
  )
    throw new Error('INVALID_TOOLS');
  return list;
}
const safeWebUrl = (value?: string) => {
  try {
    const u = new URL(value || '');
    return u.protocol === 'https:' && !u.username && !u.password;
  } catch {
    return false;
  }
};
export function useMeetingTools(
  room: NativeRoom,
  chat: ReturnType<typeof useConferenceChat>,
  t: (key: string) => string,
  openChat: () => void,
) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [selected, setSelected] = useState<string>();
  const [input, setInput] = useState(false);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string>();
  const lifecycle = useRef<AbortController | undefined>(undefined);
  const writing = useRef(false);
  const refresh = useCallback(
    async (signal: AbortSignal) => {
      const result = parsePlayers(await room.tools({ action: 'ls' }, signal));
      if (!signal.aborted) {
        setPlayers(result);
      }
    },
    [room],
  );
  useEffect(() => {
    const controller = new AbortController();
    lifecycle.current = controller;
    setPlayers([]);
    setSelected(undefined);
    setInput(false);
    setActionError(undefined);
    let timer: ReturnType<typeof setTimeout>;
    let loading = false;
    const load = async () => {
      if (loading || controller.signal.aborted) return;
      loading = true;
      try {
        await refresh(controller.signal);
      } catch {
        // Keep the last list and retry in the background without shrinking the tool tile.
      } finally {
        loading = false;
        if (!controller.signal.aborted) timer = setTimeout(() => void load(), 30000);
      }
    };
    void load();
    const off = chat.onControl((event) => {
      if (event === 'tools') {
        clearTimeout(timer);
        void load();
      }
    });
    return () => {
      controller.abort();
      clearTimeout(timer);
      off();
    };
  }, [room, refresh, chat.onControl]);
  const run = async (action: string) => {
    const controller = lifecycle.current;
    if (!controller || controller.signal.aborted || writing.current) return;
    writing.current = true;
    setBusy(true);
    setActionError(undefined);
    try {
      let body: FormData | Record<string, unknown> = { action, url: url.trim() };
      if (action === 'upload') {
        const selection = await pickDocument([
          'image/png',
          'image/jpeg',
          'image/webp',
          'image/gif',
        ]);
        if (selection.canceled || controller.signal.aborted) return;
        const asset = selection.assets[0];
        if (asset.size && asset.size > 10 * 1024 * 1024) throw new Error('FILE_TOO_LARGE');
        body = new FormData();
        body.append('action', action);
        body.append('file', {
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType || 'image/jpeg',
        } as unknown as Blob);
      }
      const result = parsePlayers(await room.tools(body, controller.signal));
      if (!controller.signal.aborted) {
        setPlayers(result);
        setInput(false);
        setUrl('');
      }
    } catch (error) {
      if (!controller.signal.aborted)
        setActionError(toolErrorKey(error, 'shared_meeting.tools_error'));
    } finally {
      writing.current = false;
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  const definitions: {
    id: string;
    name: OutlineGlyphMapType;
    label: string;
    action: () => void;
  }[] = [
    {
      id: 'image',
      name: 'file-image',
      label: t('common.upload'),
      action: () => void run('upload'),
    },
    { id: 'iframe', name: 'layout', label: 'Iframe', action: () => setInput(true) },
    {
      id: 'browser',
      name: 'global',
      label: 'HyperBeam',
      action: () => void run('create_hyperbeam'),
    },
    {
      id: 'whiteboard',
      name: 'edit',
      label: t('common.whiteboard.title'),
      action: () => void run('create_whiteboard'),
    },
    { id: 'chat', name: 'message', label: t('common.chat'), action: openChat },
  ];
  const player = players.find((p) => p.id === selected);
  const icon = (name: OutlineGlyphMapType) => <IconOutline name={name} size={24} color="#abbcc5" />;
  const folder = (
    <View style={{ flex: 1 }}>
      <MeetingToolFolder
        label={t('more.app.title')}
        closeLabel={t('common.close')}
        items={definitions.map((d) => ({
          id: d.id,
          icon: icon(d.name),
          content: (close) => (
            <Pressable
              accessibilityLabel={d.label}
              accessibilityRole="button"
              disabled={busy}
              style={styles.tool}
              onPress={() => {
                close();
                d.action();
              }}
            >
              {icon(d.name)}
            </Pressable>
          ),
        }))}
      />
    </View>
  );
  const extraTiles = [
    { id: 'tools:add', content: folder },
    ...players.map((p) => ({
      id: `tool:${p.id}`,
      content: (
        <Pressable
          style={styles.tile}
          accessibilityRole="button"
          accessibilityLabel={p.mode}
          onPress={() => setSelected(p.id)}
        >
          {p.mode === 'image' && p.url ? (
            <Image source={{ uri: p.url }} style={styles.image} resizeMode="contain" />
          ) : (
            <>
              {icon(p.mode === 'whiteboard' ? 'edit' : 'global')}
              <Text style={styles.text}>
                {p.mode === 'whiteboard'
                  ? t('common.whiteboard.title')
                  : p.mode === 'hyperbeam'
                    ? 'HyperBeam'
                    : p.url}
              </Text>
            </>
          )}
        </Pressable>
      ),
    })),
  ];
  const dialog = (
    <>
      {players
        .filter((item) => item.mode === 'whiteboard')
        .map((item) => (
          <Whiteboard
            key={item.id}
            id={item.id}
            room={room}
            chat={chat}
            open={selected === item.id}
            onClose={() => setSelected(undefined)}
            t={t}
            onError={() => setActionError('shared_meeting.tools_error')}
          />
        ))}
      <Modal
        visible={input || (!!player && player.mode !== 'whiteboard')}
        animationType="slide"
        onRequestClose={() => {
          setInput(false);
          setSelected(undefined);
        }}
      >
        <SafeAreaView style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.text}>{t('more.app.title')}</Text>
            <Button
              appearance="icon"
              label={t('common.close')}
              onPress={() => {
                setInput(false);
                setSelected(undefined);
              }}
            >
              <MeetingIcon name="close" />
            </Button>
          </View>
          {actionError && <Text style={styles.error}>{t(actionError)}</Text>}
          {input ? (
            <View style={{ padding: 16, gap: 16 }}>
              <TextInput
                style={styles.input}
                value={url}
                onChangeText={setUrl}
                autoCapitalize="none"
                keyboardType="url"
                placeholder="https://"
                placeholderTextColor="#8796a0"
              />
              <Button
                appearance="primary"
                disabled={busy || !safeWebUrl(url.trim())}
                onPress={() => void run('set_meta')}
              >
                {t('common.confirm')}
              </Button>
            </View>
          ) : player?.mode === 'image' ? (
            <Image source={{ uri: player.url }} style={{ flex: 1 }} resizeMode="contain" />
          ) : player && safeWebUrl(player.url) ? (
            <WebView
              key={player.id}
              source={{ uri: player.url! }}
              originWhitelist={['https://*']}
              onShouldStartLoadWithRequest={(r) => r.url === 'about:blank' || safeWebUrl(r.url)}
              setSupportMultipleWindows={false}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction
              onError={() => setActionError('shared_meeting.tools_error')}
              style={{ flex: 1 }}
            />
          ) : null}
        </SafeAreaView>
      </Modal>
    </>
  );
  return { extraTiles, dialog, open: input || !!player };
}
const styles = StyleSheet.create({
  tool: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  tile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#202020',
    borderRadius: 16,
    padding: 12,
    gap: 12,
  },
  image: { width: '100%', height: '100%' },
  text: { color: '#d9e4ea', fontSize: 16 },
  error: { color: '#ff9898', padding: 6, fontSize: 12 },
  modal: { flex: 1, backgroundColor: '#171f25' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  input: { color: '#fff', borderColor: '#425863', borderWidth: 1, borderRadius: 8, padding: 12 },
});
