import { useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import * as Crypto from 'expo-crypto';
import type { createNativeApi } from '../../api/session';
import { pickDocument } from '../../ui/document-picker';

export function useChatFiles(api: ReturnType<typeof createNativeApi> | undefined, joinId?: string) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  const current = useRef(joinId);
  current.current = joinId;
  const selection = useRef<
    { id: string; uri: string; name: string; mimeType?: string } | undefined
  >(undefined);
  const abort = useRef<AbortController | undefined>(undefined);
  const flight = useRef<AbortController | undefined>(undefined);
  useEffect(() => {
    setOpen(false);
    setFiles([]);
    setError(false);
    setBusy(false);
    setPending(false);
    selection.current = undefined;
    flight.current = undefined;
    return () => {
      abort.current?.abort();
    };
  }, [joinId]);
  const request = async (body: FormData | Record<string, string>, signal: AbortSignal) => {
    if (!api || !joinId) throw new Error('MEMBERSHIP_REQUIRED');
    const response = await api.sdk.transport('api/v1/native/files', {
      method: 'POST',
      signal,
      ...(body instanceof FormData
        ? { body }
        : {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...body, joinId }),
          }),
    });
    if (!response.ok) throw new Error('FILE_REQUEST_FAILED');
    return response.json();
  };
  const run = async (operation: (signal: AbortSignal) => Promise<void>) => {
    if (!joinId || flight.current) return;
    const controller = new AbortController();
    abort.current = controller;
    flight.current = controller;
    setBusy(true);
    setError(false);
    try {
      await operation(controller.signal);
    } catch {
      if (current.current === joinId) setError(true);
    } finally {
      if (flight.current === controller) flight.current = undefined;
      if (current.current === joinId) setBusy(false);
    }
  };
  const upload = () =>
    run(async (signal) => {
      if (!selection.current) {
        const result = await pickDocument();
        if (result.canceled || current.current !== joinId || signal.aborted) return;
        const asset = result.assets[0];
        if (asset.size && asset.size > 100 * 1024 * 1024) throw new Error('FILE_TOO_LARGE');
        selection.current = { ...asset, id: Crypto.randomUUID() };
        setPending(true);
      }
      const selected = selection.current;
      const form = new FormData();
      form.append('joinId', joinId!);
      form.append('action', 'upload');
      form.append('id', selected.id);
      form.append('file', {
        uri: selected.uri,
        name: selected.name,
        type: selected.mimeType || 'application/octet-stream',
      } as unknown as Blob);
      await request(form, signal);
      if (current.current === joinId) {
        selection.current = undefined;
        setPending(false);
      }
    });
  const list = () =>
    run(async (signal) => {
      setOpen(true);
      const result = await request({ action: 'list' }, signal);
      if (
        !Array.isArray(result.files) ||
        result.files.some((name: unknown) => typeof name !== 'string')
      )
        throw new Error('INVALID_FILES');
      if (current.current === joinId) setFiles(result.files);
    });
  const download = (name: string) =>
    run(async (signal) => {
      const result = await request({ action: 'download', name }, signal);
      if (current.current !== joinId || signal.aborted) return;
      if (typeof result.url !== 'string' || !/^https?:\/\//.test(result.url))
        throw new Error('INVALID_URL');
      await Linking.openURL(result.url);
    });
  return { open, setOpen, files, busy, error, pending, upload, list, download };
}
