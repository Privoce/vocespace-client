import Toast from '@ant-design/react-native/lib/toast';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  Modal,
  Text,
  View,
  TextInput,
  StyleSheet,
  BackHandler,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ToolWebView, safeToolUrl as safeWebUrl } from './ToolWebView';
import { IconOutline, type OutlineGlyphMapType } from '@ant-design/icons-react-native';
import { MeetingToolsPanel } from '@vocespace/ui';
import { ApiError } from '@vocespace/client-sdk';
import { MeetingButton as Button, MeetingIcon } from '../../ui/meeting';
import { pickDocument } from '../../ui/document-picker';
import type { NativeRoom } from '../room';
import type { useConferenceChat } from '../../chat/hooks/useConferenceChat';
import { Whiteboard } from './Whiteboard';

type Player = {
  id: string;
  canRemove?: boolean;
  mode: 'image' | 'iframe' | 'hyperbeam' | 'whiteboard';
  url?: string;
};
function toolErrorKey(error: unknown, fallback: string, action?: string) {
  if (action === 'create_whiteboard' && error instanceof ApiError && error.status === 409)
    return 'common.whiteboard.only_one_tile';
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
        (p.url !== undefined && typeof p.url !== 'string') ||
        (p.canRemove !== undefined && typeof p.canRemove !== 'boolean'),
    )
  )
    throw new Error('INVALID_TOOLS');
  return list;
}
export function useMeetingTools(
  room: NativeRoom,
  chat: ReturnType<typeof useConferenceChat>,
  t: (key: string) => string,
  onToolSelect: () => void,
) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [selected, setSelected] = useState<string>();
  const [input, setInput] = useState(false);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<string>();
  const [drawing, setDrawing] = useState(false);
  const [actionError, setActionError] = useState<string>();
  const lifecycle = useRef<AbortController | undefined>(undefined);
  const writing = useRef(false);
  const revision = useRef(0);
  const refresh = useCallback(
    async (signal: AbortSignal) => {
      const started = revision.current;
      const result = parsePlayers(await room.tools({ action: 'ls' }, signal));
      if (!signal.aborted && started === revision.current) {
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
    setBusy(false);
    setPendingAction(undefined);
    writing.current = false;
    let timer: ReturnType<typeof setTimeout>;
    let loading = false;
    const load = async () => {
      if (loading || controller.signal.aborted) return;
      loading = true;
      try {
        await refresh(controller.signal);
      } catch {
        // Keep the last list and retry silently in the background.
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
  const run = async (action: string, playerId?: string) => {
    if (action === 'create_whiteboard') {
      const existing = players.find((item) => item.mode === 'whiteboard');
      if (existing) {
        setSelected(existing.id);
        onToolSelect();
        return;
      }
    }
    const controller = lifecycle.current;
    if (!controller || controller.signal.aborted || writing.current) return;
    writing.current = true;
    revision.current++;
    setBusy(true);
    setPendingAction(action);
    setActionError(undefined);
    try {
      let body: FormData | Record<string, unknown> = { action, playerId, url: url.trim() };
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
        if (action === 'rm' && selected === playerId) setSelected(undefined);
        if (action === 'create_whiteboard')
          setSelected(result.find((item) => item.mode === 'whiteboard')?.id);
        setInput(false);
        setUrl('');
        onToolSelect();
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        const key = toolErrorKey(error, 'shared_meeting.tools_error', action);
        setActionError(key);
        Toast.info(t(key), 3, undefined, false);
      }
    } finally {
      if (lifecycle.current === controller) {
        revision.current++;
        writing.current = false;
        if (!controller.signal.aborted) {
          setBusy(false);
          setPendingAction(undefined);
        }
      }
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
      label: t('shared_meeting.image'),
      action: () => void run('upload'),
    },
    { id: 'iframe', name: 'layout', label: 'Iframe', action: () => setInput(true) },
    {
      id: 'browser',
      name: 'global',
      label: 'Cobrowse',
      action: () => void run('create_hyperbeam'),
    },
    {
      id: 'whiteboard',
      name: 'edit',
      label: t('common.whiteboard.title'),
      action: () => void run('create_whiteboard'),
    },
    {
      id: 'upload-file',
      name: 'folder',
      label: t('shared_meeting.upload'),
      action: () => void chat.files.upload(),
    },
    {
      id: 'files',
      name: 'file',
      label: t('shared_meeting.files'),
      action: () => void chat.files.list(),
    },
  ];
  const player = players.find((p) => p.id === selected);
  const icon = (name: OutlineGlyphMapType) => <IconOutline name={name} size={24} color="#abbcc5" />;
  const panel = (
    <MeetingToolsPanel
      onSelect={onToolSelect}
      items={definitions.map((d) => ({
        id: d.id,
        label: d.label,
        icon: icon(d.name),
        disabled:
          busy ||
          ((d.id === 'upload-file' || d.id === 'files') && chat.files.busy) ||
          (d.id === 'upload-file' && chat.state.connection !== 'connected'),
        onPress: () => {
          d.action();
          // Keep pending actions visible until completion, including their spinner.
          if (!['whiteboard', 'browser', 'image'].includes(d.id)) onToolSelect();
        },
        content:
          pendingAction &&
          pendingAction ===
            (
              {
                whiteboard: 'create_whiteboard',
                browser: 'create_hyperbeam',
                image: 'upload',
              } as Record<string, string>
            )[d.id] ? (
            <ActivityIndicator color="#22CCEE" />
          ) : (
            icon(d.name)
          ),
      }))}
    />
  );
  useEffect(() => {
    if (selected && !players.some((item) => item.id === selected)) setSelected(undefined);
  }, [players, selected]);
  useEffect(() => {
    if (!selected) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      setSelected(undefined);
      return true;
    });
    return () => listener.remove();
  }, [selected]);
  const extraTiles = players.map((p) => ({
    id: `tool:${p.id}`,
    content: (
      <View style={styles.tile}>
        <View style={styles.preview}>
          {p.mode === 'image' && p.url ? (
            <Image source={{ uri: p.url }} style={styles.image} resizeMode="contain" />
          ) : p.mode === 'whiteboard' ? (
            <Whiteboard
              id={p.id}
              room={room}
              chat={chat}
              t={t}
              onDrawingChange={setDrawing}
              onError={() => Toast.info(t('shared_meeting.tools_error'), 3, undefined, false)}
            />
          ) : safeWebUrl(p.url) ? (
            <ToolWebView
              url={p.url!}
              cobrowse={p.mode === 'hyperbeam'}
              onError={() => Toast.info(t('shared_meeting.tools_error'), 3, undefined, false)}
            />
          ) : null}
        </View>
        <View style={styles.tileBar}>
          <Text numberOfLines={1} style={[styles.text, { flex: 1, fontSize: 12 }]}>
            {p.mode === 'whiteboard'
              ? t('common.whiteboard.title')
              : p.mode === 'hyperbeam'
                ? 'Cobrowse'
                : p.mode === 'image'
                  ? t('shared_meeting.image')
                  : 'Iframe'}
          </Text>
          <Button
            appearance="icon"
            label={t(selected === p.id ? 'phone_meeting.exit_fullscreen' : 'common.full_screen')}
            onPress={() => setSelected(selected === p.id ? undefined : p.id)}
          >
            <MeetingIcon name={selected === p.id ? 'fullscreenExit' : 'fullscreen'} />
          </Button>
          {p.canRemove && (
            <Button
              appearance="icon"
              label={t('common.close')}
              disabled={busy}
              onPress={() => void run('rm', p.id)}
            >
              <MeetingIcon name="close" />
            </Button>
          )}
        </View>
      </View>
    ),
  }));
  const dialog = (
    <>
      <Modal
        visible={input}
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
          ) : null}
        </SafeAreaView>
      </Modal>
    </>
  );
  return {
    extraTiles,
    panel,
    dialog,
    fullscreenTileId: selected ? `tool:${selected}` : undefined,
    open: input || !!player || drawing,
  };
}
const styles = StyleSheet.create({
  tile: { flex: 1, backgroundColor: '#202020', borderRadius: 16, overflow: 'hidden' },
  preview: { flex: 1, width: '100%' },
  tileBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, minHeight: 40 },
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
