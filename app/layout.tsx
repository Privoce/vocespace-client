import { I18nProvider } from '@/lib/i18n/i18n';
import '../styles/globals.css';
import '@livekit/components-styles';
import '@livekit/components-styles/prefabs';
import type { Metadata, Viewport } from 'next';
import { ConfigProvider } from 'antd';

export const metadata: Metadata = {
  title: {
    default: 'Voce Space | Self-hosted conference app',
    template: '%s',
  },
  description:
    'Voce space is WebRTC project that gives you everything needed to build scalable and real-time audio and/or video experiences in your applications.',
  icons: {
    icon: {
      rel: 'icon',
      url: '/favicon.ico',
    },
    apple: [
      {
        rel: 'apple-touch-icon',
        url: '/images/livekit-apple-touch.png',
        sizes: '180x180',
      },
      { rel: 'mask-icon', url: '/images/livekit-safari-pinned-tab.svg', color: '#070707' },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: '#070707',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#22CCEE',
          borderRadius: 4,
          colorText: '#8c8c8c',
        },
        components: {
          Switch: {
            handleBg: '#ffffff',
          },
          Radio: {
            buttonBg: '#1E1E1E',
            colorBorder: '#1E1E1E',
          },
          // Select: {
          //   optionSelectedBg: '#cbf6ff',
          // }
          Select: {
            selectorBg: '#1E1E1E',
            activeBorderColor: '#1E1E1E',
            activeOutlineColor: '#1E1E1E',
            colorTextPlaceholder: '#ffffff',
            colorText: '#ffffff',
            colorIcon: '#ffffff',
            colorIconHover: '#ffffff',
            hoverBorderColor: '#1E1E1E',
            optionSelectedBg: '#22CCEE',
            optionSelectedColor: '#fff',
            optionActiveBg: '#1E1E1E',
            colorBgBase: '#1E1E1E',
            multipleItemBg: '#1E1E1E',
            colorBorder: '#1E1E1E',
            colorBgContainer: '#1E1E1E',
            colorBgLayout: '#1E1E1E',
            colorBgElevated: '#1E1E1E',
          },
        },
      }}
    >
      <html lang="en">
        <body>
          <I18nProvider initialLocale="en">{children}</I18nProvider>
        </body>
      </html>
    </ConfigProvider>
  );
}
