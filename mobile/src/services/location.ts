import {PermissionsAndroid, Platform} from 'react-native';
import Geolocation from '@react-native-community/geolocation';

export type Coordinates = {latitude: number; longitude: number};

async function requestAndroidPermission() {
  if (Platform.OS !== 'android') {
    return true;
  }
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    {
      title: 'อนุญาตตำแหน่ง',
      message: 'ใช้ตำแหน่งเพื่อแสดงสัตว์ที่หายหรือพบใกล้คุณ',
      buttonPositive: 'อนุญาต',
      buttonNegative: 'ยกเลิก',
    },
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export async function getCurrentCoordinates(): Promise<Coordinates> {
  const granted = await requestAndroidPermission();
  if (!granted) {
    throw new Error('ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง');
  }
  if (Platform.OS === 'ios') {
    await Geolocation.requestAuthorization('whenInUse');
  }
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      position => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }),
      error => reject(new Error(error.message)),
      {enableHighAccuracy: true, timeout: 15_000, maximumAge: 10_000},
    );
  });
}
