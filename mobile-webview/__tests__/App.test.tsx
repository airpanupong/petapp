import React from 'react';
import { AccessibilityInfo } from 'react-native';
import Renderer, { act } from 'react-test-renderer';
import App from '../App';
import { SplashScreen } from '../src/SplashScreen';
import { PetLoading } from '../src/PetLoading';

jest.mock('react-native-webview', () => 'MockWebView');
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: require('react-native').View,
}));

let tree: Renderer.ReactTestRenderer;
beforeEach(() => {
  jest.useFakeTimers();
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
});
afterEach(() => {
  act(() => tree?.unmount());
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});
const web = () => tree.root.findByType('MockWebView' as React.ElementType);
const splash = () => tree.root.findByType(SplashScreen);

test('keeps launch splash until both minimum duration and web load finish', async () => {
  await act(async () => {
    tree = Renderer.create(<App />);
  });
  act(() => web().props.onLoadEnd());
  expect(splash().props.visible).toBe(true);
  act(() => jest.advanceTimersByTime(2200));
  expect(splash().props.visible).toBe(false);
  act(() => jest.advanceTimersByTime(300));
  expect(tree.root.findAllByProps({ testID: 'splash-screen' })).toHaveLength(0);
});

test('shows compact loading on navigation and clears it on load end', async () => {
  await act(async () => {
    tree = Renderer.create(<App />);
  });
  act(() => {
    web().props.onLoadEnd();
    jest.advanceTimersByTime(2200);
  });
  act(() => jest.advanceTimersByTime(300));
  await act(async () => web().props.onLoadStart());
  expect(tree.root.findByType(PetLoading).props.compact).toBe(true);
  act(() => web().props.onLoadEnd());
  expect(tree.root.findAllByType(PetLoading)).toHaveLength(0);
});

test('remounts splash on retry after an error and waits for its new minimum', async () => {
  await act(async () => {
    tree = Renderer.create(<App />);
  });
  act(() => web().props.onError({ nativeEvent: { description: 'Offline' } }));
  act(() => jest.advanceTimersByTime(2500));
  expect(tree.root.findAllByProps({ testID: 'splash-screen' })).toHaveLength(0);
  await act(async () =>
    tree.root.findAllByProps({ testID: 'retry-load' })[0].props.onPress(),
  );
  expect(
    tree.root.findAllByProps({ testID: 'splash-screen' }).length,
  ).toBeGreaterThan(0);
  act(() => web().props.onLoadEnd());
  expect(splash().props.visible).toBe(true);
  act(() => jest.advanceTimersByTime(2200));
  expect(splash().props.visible).toBe(false);
});
