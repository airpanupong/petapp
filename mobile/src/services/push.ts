import {Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {check, request, PERMISSIONS, RESULTS, requestNotifications} from 'react-native-permissions';

import {api} from '../api/client';
import {ApiSuccess} from '../types/api';

const DEVICE_KEY = 'petapp.device_id';

async function ensureDeviceId() {
  let id = await AsyncStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = `dev-${Platform.OS}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    await AsyncStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

async function ensureNotificationPermission() {
  try {
    if (Platform.OS === 'ios') {
      await requestNotifications(['alert', 'sound', 'badge']);
      return true;
    }
    if (typeof Platform.Version === 'number' && Platform.Version >= 33) {
      const status = await check(PERMISSIONS.ANDROID.POST_NOTIFICATIONS);
      if (status === RESULTS.GRANTED) return true;
      const next = await request(PERMISSIONS.ANDROID.POST_NOTIFICATIONS);
      return next === RESULTS.GRANTED;
    }
  } catch {
    // ignore
  }
  return true;
}

async function resolveFcmToken(): Promise<string | null> {
  try {
    // Optional: works when @react-native-firebase/messaging + google-services are configured.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const messaging = require('@react-native-firebase/messaging').default;
    await messaging().requestPermission();
    if (messaging().registerDeviceForRemoteMessages) {
      await messaging().registerDeviceForRemoteMessages();
    }
    const token = await messaging().getToken();
    return token || null;
  } catch {
    return null;
  }
}

export async function registerPushDevice() {
  try {
    await ensureNotificationPermission();
    const deviceId = await ensureDeviceId();
    const fcm = await resolveFcmToken();
    const token = fcm || `dev-${deviceId}`;
    await api.post<ApiSuccess<unknown>>('/devices', {
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      token,
      device_id: deviceId,
    });
  } catch {
    // non-fatal — in-app notifications still work
  }
}
