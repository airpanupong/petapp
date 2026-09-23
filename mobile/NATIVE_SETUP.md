# Native Setup — React Native CLI (NO EXPO)

Run `./scripts/generate-native.sh` once before the first native build.

## Android permissions

Add to `android/app/src/main/AndroidManifest.xml` above `<application>`:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

Inside `<application>` for Google Maps:

```xml
<meta-data
  android:name="com.google.android.geo.API_KEY"
  android:value="YOUR_GOOGLE_MAPS_API_KEY" />
```

## iOS Info.plist

Add:

```xml
<key>NSCameraUsageDescription</key>
<string>ใช้กล้องเพื่อสแกน QR และช่วยระบุสัตว์เลี้ยง</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>ใช้ตำแหน่งเพื่อแสดงสัตว์หายและสัตว์ที่พบใกล้คุณ</string>
```

For `react-native-permissions`, add the permission setup requested by the package to the generated Podfile, then run:

```bash
cd ios
bundle install
bundle exec pod install
```

## API address

Android emulator: `http://10.0.2.2:8000/api/v1`

iOS simulator: `http://127.0.0.1:8000/api/v1`

Update `src/config/env.ts` as appropriate.
