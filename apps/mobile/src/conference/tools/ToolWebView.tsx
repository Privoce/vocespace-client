import { useMemo } from 'react';
import { WebView } from 'react-native-webview';

export function safeToolUrl(value?: string) {
  try {
    const url = new URL(value || '');
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** Cobrowse embed URLs require the same Hyperbeam host SDK used by Web. */
export function ToolWebView({
  url,
  cobrowse,
  onError,
}: {
  url: string;
  cobrowse: boolean;
  onError: () => void;
}) {
  const source = useMemo(
    () =>
      cobrowse
        ? {
            baseUrl: 'https://hyperbeam.com',
            html: `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>html,body,#browser{margin:0;width:100%;height:100%;overflow:hidden;background:#202020}</style></head><body><div id="browser"></div><script type="module">
      let browser;
      let retry;
      const reconnect = () => { clearTimeout(retry); retry = setTimeout(() => browser?.reconnect(), 1000); };
      try {
        const { default: Hyperbeam } = await import('https://unpkg.com/@hyperbeam/web@0.0.38/dist/index.js');
        browser = await Hyperbeam(document.getElementById('browser'), ${JSON.stringify(url).replace(/</g, '\\u003c')}, {
          onConnectionStateChange: event => { if (event.state === 'failed') reconnect(); },
          onDisconnect: event => { if (event.type === 'unknown') reconnect(); }
        });
        window.addEventListener('pagehide', () => { clearTimeout(retry); browser.destroy(); }, { once: true });
      } catch { window.ReactNativeWebView?.postMessage('load_failed'); }
    </script></body></html>`,
          }
        : { uri: url },
    [url, cobrowse],
  );
  return (
    <WebView
      source={source}
      onError={onError}
      onHttpError={onError}
      onMessage={(event) => {
        if (event.nativeEvent.data === 'load_failed') onError();
      }}
      originWhitelist={['https://*']}
      onShouldStartLoadWithRequest={(request) =>
        request.url === 'about:blank' || safeToolUrl(request.url)
      }
      setSupportMultipleWindows={false}
      allowsInlineMediaPlayback
      allowsFullscreenVideo
      mediaPlaybackRequiresUserAction
      style={{ flex: 1, backgroundColor: '#202020' }}
    />
  );
}
