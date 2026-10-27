import { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { accountAvatarInitial } from '@vocespace/contracts';

export function AccountAvatar({
  username,
  avatar,
  size = 64,
}: {
  username: string;
  avatar?: string;
  size?: number;
}) {
  const [failedUrl, setFailedUrl] = useState<string>();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#22CCEE',
      }}
    >
      {avatar && failedUrl !== avatar ? (
        <Image
          source={{ uri: avatar }}
          resizeMode="cover"
          style={{ width: size, height: size }}
          onError={() => setFailedUrl(avatar)}
        />
      ) : (
        <Text style={{ color: '#fff', fontSize: size * 0.45, fontWeight: '600' }}>
          {accountAvatarInitial(username)}
        </Text>
      )}
    </View>
  );
}
