import React, {useEffect} from 'react';
import {StatusBar} from 'react-native';
import {NavigationContainer, DefaultTheme} from '@react-navigation/native';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {RootNavigator} from './src/navigation/RootNavigator';
import {useAuthStore} from './src/store/authStore';
import {registerPushDevice} from './src/services/push';
import {colors} from './src/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {retry: 1, staleTime: 30_000},
    mutations: {retry: 0},
  },
});

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.cardSolid,
    text: colors.text,
    border: colors.border,
    primary: colors.primary,
  },
};

function PushBootstrap() {
  const status = useAuthStore(s => s.status);
  useEffect(() => {
    if (status === 'authenticated') {
      void registerPushDevice();
    }
  }, [status]);
  return null;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer theme={navTheme}>
          <StatusBar barStyle="dark-content" />
          <PushBootstrap />
          <RootNavigator />
        </NavigationContainer>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
