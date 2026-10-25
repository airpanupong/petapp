/**
 * Pet haii — React Native CLI shell (no Expo).
 * Full-screen WebView over the production / local web app.
 *
 * @format
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  Linking,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RNWebView, { type WebViewNavigation } from 'react-native-webview';

import { ALLOWED_HOSTS, WEB_BASE_URL } from './src/config';
import { SplashScreen } from './src/SplashScreen';

const WebView = RNWebView as unknown as React.ComponentType<
  Record<string, unknown>
>;

function hostOf(url: string): string | null {
  const m = url.match(/^https?:\/\/([^/?#]+)/i);
  if (!m) return null;
  return m[1].replace(/^\[|\]$/g, '').split(':')[0] || null;
}

function isAllowedUrl(url: string): boolean {
  if (
    url.startsWith('about:') ||
    url.startsWith('blob:') ||
    url.startsWith('data:')
  ) {
    return true;
  }
  const host = hostOf(url);
  if (!host) return false;
  if (ALLOWED_HOSTS.has(host)) return true;
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return true;
  return false;
}

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#ffffff"
        translucent={false}
      />
      <WebShell />
    </SafeAreaProvider>
  );
}

function WebShell() {
  const webRef = useRef<{ goBack: () => void; reload: () => void } | null>(
    null,
  );
  const [canGoBack, setCanGoBack] = useState(false);
  const [webReady, setWebReady] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const loadedOnce = useRef(false);
  const splashVisible = !(webReady && introDone) && !error;
  const onIntroEnd = useCallback(() => setIntroDone(true), []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack && webRef.current) {
        webRef.current.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack]);

  const onNavChange = useCallback((nav: WebViewNavigation) => {
    setCanGoBack(nav.canGoBack);
  }, []);

  const onShouldStart = useCallback((req: { url: string }): boolean => {
    const { url } = req;
    if (isAllowedUrl(url)) return true;
    Linking.openURL(url).catch(() => undefined);
    return false;
  }, []);

  const reload = () => {
    loadedOnce.current = false;
    setError(null);
    setWebReady(false);
    setIntroDone(false);
    setLoadAttempt(attempt => attempt + 1);
    webRef.current?.reload();
  };

  return (
    <View style={styles.root}>
      <WebView
        ref={webRef}
        source={{ uri: WEB_BASE_URL }}
        style={styles.webview}
        applicationNameForUserAgent="PetHaiiApp/1.0"
        allowsBackForwardNavigationGestures
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        setSupportMultipleWindows={false}
        geolocationEnabled
        mediaCapturePermissionGrantType="grantIfSameHostElsePrompt"
        onNavigationStateChange={onNavChange}
        onShouldStartLoadWithRequest={onShouldStart}
        onLoadStart={() => {
          if (loadedOnce.current) return;
          setError(null);
        }}
        onLoadEnd={() => {
          loadedOnce.current = true;
          setWebReady(true);
        }}
        onError={(e: { nativeEvent: { description?: string } }) => {
          setWebReady(true);
          setError(e.nativeEvent.description || 'โหลดหน้าไม่สำเร็จ');
        }}
        onHttpError={(e: { nativeEvent: { statusCode: number } }) => {
          if (e.nativeEvent.statusCode >= 500) {
            setError(`เซิร์ฟเวอร์ตอบ ${e.nativeEvent.statusCode}`);
          }
        }}
      />

      <SplashScreen
        key={loadAttempt}
        visible={splashVisible}
        onIntroEnd={onIntroEnd}
      />

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>เชื่อมต่อไม่สำเร็จ</Text>
          <Text style={styles.errorMsg}>{error}</Text>
          <Text style={styles.errorUrl}>{WEB_BASE_URL}</Text>
          <Pressable
            testID="retry-load"
            accessibilityRole="button"
            style={styles.retry}
            onPress={reload}
          >
            <Text style={styles.retryText}>ลองอีกครั้ง</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#fff5f2',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  errorBox: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 60,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    backgroundColor: '#fff5f2',
    gap: 8,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3d2c28',
  },
  errorMsg: {
    fontSize: 14,
    color: '#7a635e',
    textAlign: 'center',
  },
  errorUrl: {
    fontSize: 12,
    color: '#a8908a',
    marginBottom: 8,
  },
  retry: {
    marginTop: 8,
    backgroundColor: '#f2657f',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
  retryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});

export default App;
