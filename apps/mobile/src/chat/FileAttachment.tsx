import { useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { IconOutline } from '@ant-design/icons-react-native';
import type { useChatFiles } from './hooks/useChatFiles';

export function isChatImage(name: string) {
  return /\.(png|jpe?g|webp|gif)$/i.test(name);
}

/** Both chat bubbles and the file gallery use membership-bound image URLs. */
export function FileAttachment({
  name,
  storageName,
  files,
  gallery = false,
}: {
  name: string;
  storageName: string;
  files: ReturnType<typeof useChatFiles>;
  gallery?: boolean;
}) {
  const image = isChatImage(storageName);
  const [url, setUrl] = useState<string>();
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!image) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const next = await files.resolveFile(storageName, controller.signal);
        if (!controller.signal.aborted) setUrl(next);
      } catch {
        /* The filename remains usable; opening retries the request. */
      }
      if (!controller.signal.aborted) timer = setTimeout(() => void load(), 90000);
    };
    void load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [files.resolveFile, storageName, image, retry]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={name}
      onPress={() => void files.download(storageName, name)}
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 8,
        width: gallery ? '100%' : image ? 180 : undefined,
      }}
    >
      {image && url ? (
        <Image
          source={{ uri: url }}
          resizeMode="contain"
          style={{ width: '100%', height: gallery ? 96 : 132 }}
          onError={() => {
            if (retry < 1) setRetry(1);
          }}
        />
      ) : (
        <View style={{ height: gallery ? 96 : 44, justifyContent: 'center' }}>
          <IconOutline
            name={image ? 'file-image' : 'file'}
            size={gallery ? 46 : 30}
            color="#22ccee"
          />
        </View>
      )}
      {(!image || gallery) && (
        <Text numberOfLines={2} style={{ color: '#eee', fontSize: 13, textAlign: 'center' }}>
          {name}
        </Text>
      )}
    </Pressable>
  );
}
