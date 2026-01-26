// core styles shared by all of react-notion-x (required)
import 'react-notion-x/styles.css';
import { I18nProvider } from '@/lib/i18n/i18n';
import '../styles/globals.css';
import '@livekit/components-styles';
import '@livekit/components-styles/prefabs';
import type { Metadata, Viewport } from 'next';
import { ConfigProvider } from 'antd';

export const metadata: Metadata = {
  title: {
    default: 'Video Customer Service by SoHive',
    template: '%s',
  },
  description:
    'Deliver personalized customer experiences with drop-in video and shared sessions. No apps, no code—just better engagement and sales outcomes. Engage customers in virtual communities with drop-in video chats, live sessions, and shared experiences. No code or apps—just seamless engagement. 24/7 drop-in video, live chat, and shared sessions in one no-code platform. Attract prospects and drive customer engagement with zero app installs.',
  icons: {
    icon: {
      rel: 'icon',
      url: '/favicon.ico',
    },
    // apple: [
    //   {
    //     rel: 'apple-touch-icon',
    //     url: '/images/livekit-apple-touch.png',
    //     sizes: '180x180',
    //   },
    //   { rel: 'mask-icon', url: '/images/livekit-safari-pinned-tab.svg', color: '#070707' },
    // ],
  },
};

export const viewport: Viewport = {
  themeColor: '#F59346',
};

const neutral = {
  25: '#FCFCFD',
  50: '#F9FAFB',
  100: '#F2F4F7',
  200: '#EAECF0',
  300: '#D0D5DD',
  400: '#98A2B3',
  500: '#667085',
  600: '#475467',
  700: '#344054',
  800: '#1D2939',
  900: '#101828',
};

const brand = {
  primary: '#F59346',
  primaryHover: '#F5B05F',
  primaryActive: '#F5B05F',
  primaryText: '#000',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#F5B05F',
          borderRadius: 4,
          colorText: "#000000",
          colorTextDisabled: '#333',
        },
        components: {
          Button: {
            defaultColor: '#F59346',
          },
          Dropdown: {
            colorBgElevated: '#fff',
            controlItemBgHover: '#F5B05F',
            colorTextDisabled: '#8c8c8c',
            colorTextDescription: '#8c8c8c',
            colorText: '#000',
          },
          Spin: {
            dotSize: 32,
            colorBgContainer: "#fff",
            colorFillSecondary: "#fff",
            colorBgBase: "#fff",
            colorBgMask: "#fff"
          },
          Radio: {
            buttonBg: '#F59346',
            colorBorder: '#fff',
            buttonCheckedBg: '#fff',
            buttonColor: "#fff"
          },
          Input: {
            colorBgBase: '#fff',
            activeBg: '#fff',
            colorBgContainer: '#fff',
            colorBorder: '#F5B05F',
            colorTextPlaceholder: '#8c8c8c',
            paddingBlockLG: 8,
            colorBorderSecondary: '#fff',
            colorText: '#000',
          },
          InputNumber: {
            colorBgBase: '#fff',
            activeBg: '#fff',
            colorBgContainer: '#fff',
            colorBorder: '#F5B05F',
            colorTextPlaceholder: '#8c8c8c',
            paddingBlockLG: 8,
            colorText: '#000',
            handleBg: '#F5B05F',
            handleWidth: 32,
            handleVisible: true,
            handleHoverColor: '#fff',
          },
          Timeline: {
            dotBg: 'transparent',
            tailColor: '#F5B05F',
          },
          DatePicker: {
            colorBgContainer: '#fff',
            colorTextPlaceholder: '#8c8c8c',
            colorText: '#000',
            colorBorder: '#fff',
            colorBgBase: '#fff',
            colorIcon: '#ffffff',
            colorBgElevated: '#fff',
            cellActiveWithRangeBg: '#F5B05F',
            cellHoverBg: '#333',
            cellBgDisabled: '#fff',
            colorTextDisabled: '#8c8c8c',
          },
          Slider: {
            railHoverBg: '#F59346',
            trackBg: '#F59346',
            trackHoverBg: '#F5B05F',
            railBg: '#F5B05F',
          },
          Select: {
            selectorBg: '#fff',
            activeBorderColor: '#F5B05F',
            activeOutlineColor: '#fff',
            colorTextPlaceholder: '#ffffff',
            colorText: '#000',
            colorIcon: '#ffffff',
            colorIconHover: '#ffffff',
            hoverBorderColor: '#F5B05F',
            optionSelectedBg: '#F5B05F',
            optionSelectedColor: '#fff',
            optionActiveBg: '#333',
            colorBgBase: '#fff',
            multipleItemBg: '#fff',
            colorBgLayout: '#fff',
            colorBgElevated: '#fff',
            colorBorder: '#F5B05F',
          },
          Popover: {
            colorBgElevated: '#fff',
          },
          Modal: {
            contentBg: '#fff',
            headerBg: '#fff',
            footerBg: '#fff',
            titleColor: '#ffffff',
          },
          Avatar: {
            groupBorderColor: '#F5B05F',
          },
          List: {
            itemPadding: '4px 0',
            metaMarginBottom: '4px',
            colorSplit: '#8c8c8c',
          },
          Card: {
            colorBgContainer: '#fff',
            colorBorder: '#fff',
            colorBorderBg: '#fff',
            colorBorderSecondary: '#fff',
            colorText: brand.primaryText,
          },
          Statistic: {
            colorText: brand.primaryText,
            colorTextDescription: brand.primaryText,
          },
          Table: {
            bodySortBg: '#fff',
            headerBg: '#2c2c2c',
            footerBg: '#fff',
            colorBgContainer: '#fff',
          },
          Menu: {
            itemActiveBg: '#F5B05F',
            itemBg: '#fff',
            itemSelectedBg: '#F5B05F',
            itemSelectedColor: '#fff',
          },
          Collapse: {
            contentPadding: 4,
            headerPadding: 4,
            headerBg: '#fff',
            contentBg: "#fff"
          },
          Badge: {
            colorBorderBg: 'transparent',
          },
          Empty: {
            colorTextDescription: '#F5B05F',
          },
          Checkbox: {
            colorBgContainer: '#fff',
            colorBorder: '#333',
            colorTextDisabled: '#888',
          },
          Tree: {
            colorBgContainer: '#fff',
            colorBorder: '#878787',
            colorBorderBg: '#fff',
            nodeSelectedBg: '#fff',
          },
          Divider: {
            colorSplit: '#333',
          },
          Skeleton: {
            gradientFromColor: '#ffffff',
            gradientToColor: '#e1e1e1',
            colorBgContainer: '#fff',
          }
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
