import { useEffect, useRef, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import type { NativeRecords } from '@vocespace/contracts';
import {
  RecordingSettingsContent,
  RecordingListContent,
  RecordingCardContent,
  type SettingsViewProps,
} from '@vocespace/ui';
import { Button, SettingsDialog, SettingsNote, SettingsSelect } from '../../ui/settings-widgets';
import type { RoomSettingsModel } from './RoomSettingsPanel';

export function RecordingSettings({
  model,
  common,
}: {
  model: RoomSettingsModel;
  common: SettingsViewProps;
}) {
  const { t } = model;
  const [data, setData] = useState<NativeRecords>();
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reload, setReload] = useState(0);
  const [sort, setSort] = useState('newest');
  const [deleting, setDeleting] = useState<string>();
  const controller = useRef(new AbortController());
  const canRead = !!model.snapshot?.room?.canReadRecordings;
  useEffect(() => {
    const abort = new AbortController();
    controller.current = abort;
    if (canRead) {
      setLoading(true);
      setError(false);
      void model.room
        .records(abort.signal)
        .then((value) => {
          if (!abort.signal.aborted) setData(value);
        })
        .catch(() => {
          if (!abort.signal.aborted) setError(true);
        })
        .finally(() => {
          if (!abort.signal.aborted) setLoading(false);
        });
    } else setData(undefined);
    return () => abort.abort();
  }, [model.room, canRead, reload]);
  const run = async (key: string, remove = false) => {
    if (loading || !canRead) return;
    const signal = controller.current.signal;
    setLoading(true);
    setError(false);
    try {
      if (remove) {
        await model.room.deleteRecording(key, signal);
        if (!signal.aborted) {
          setDeleting(undefined);
          setReload((value) => value + 1);
        }
      } else {
        const url = await model.room.downloadRecording(key, signal);
        if (!signal.aborted) await Linking.openURL(url);
      }
    } catch {
      if (!signal.aborted) setError(true);
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  };
  const records = [...(data?.records || [])].sort((a, b) =>
    sort === 'name'
      ? a.key.localeCompare(b.key)
      : sort === 'size'
        ? b.size - a.size
        : (sort === 'oldest' ? 1 : -1) * ((a.lastModified || 0) - (b.lastModified || 0)),
  );
  return (
    <>
      {RecordingSettingsContent({
        ...common,
        slots: {
          connection: (
            <Text style={{ color: '#AAA' }}>
              {t(
                !canRead
                  ? 'native_settings.records_unavailable'
                  : loading
                    ? 'recording.try_s3.connecting'
                    : error
                      ? 'recording.try_s3.connect_error'
                      : data?.configured
                        ? 'recording.try_s3.connected'
                        : 'recording.try_s3.unavailible',
              )}
            </Text>
          ),
          refresh: (
            <Button disabled={!canRead || loading} onPress={() => setReload((value) => value + 1)}>
              {t('recording.fresh')}
            </Button>
          ),
          records: RecordingListContent({
            ...common,
            sort: (
              <SettingsSelect
                label={t('recording.table.last_modified')}
                value={sort}
                onChange={setSort}
                options={[
                  { value: 'newest', label: `${t('recording.table.last_modified')} ↓` },
                  { value: 'oldest', label: `${t('recording.table.last_modified')} ↑` },
                  { value: 'name', label: `${t('recording.table.file')} ↑` },
                  { value: 'size', label: `${t('recording.table.size')} ↓` },
                ]}
              />
            ),
            empty:
              data?.configured && !records.length ? (
                <SettingsNote>{t('recording.empty')}</SettingsNote>
              ) : null,
            records: records.map((item) => (
              <View key={item.key}>
                {RecordingCardContent({
                  ...common,
                  name: item.key.split('/').pop()!,
                  tag: null,
                  size: `${(item.size / 1024 / 1024).toFixed(1)} MB`,
                  date: item.lastModified ? new Date(item.lastModified).toLocaleString() : '—',
                  actions: (
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Button
                        disabled={loading}
                        onPress={() => {
                          void run(item.key);
                        }}
                      >
                        {t('recording.download.title')}
                      </Button>
                      {data?.canDelete && (
                        <Button
                          tone="danger"
                          disabled={loading}
                          onPress={() => setDeleting(item.key)}
                        >
                          {t('recording.delete.title')}
                        </Button>
                      )}
                    </View>
                  ),
                })}
              </View>
            )),
            pagination: null,
          }),
        },
      })}
      <SettingsDialog
        open={!!deleting}
        title={t('recording.delete.confirm.title')}
        onClose={() => setDeleting(undefined)}
        confirmLabel={t('recording.delete.confirm.ok')}
        disabled={loading || !data?.canDelete}
        onConfirm={() => {
          if (deleting) void run(deleting, true);
        }}
      >
        <Text style={{ color: '#E7EDF5' }}>{deleting}</Text>
      </SettingsDialog>
    </>
  );
}
