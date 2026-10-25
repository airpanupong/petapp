# Pet haii — React Native CLI + WebView

แอปมือถือแบบ **shell** หุ้มเว็บ [pethaii.com](https://pethaii.com) ด้วย **React Native CLI** (ไม่ใช้ Expo)

| โฟลเดอร์ | ความหมาย |
| --- | --- |
| `../mobile` | แอป native เต็ม (screens / maps ฯลฯ) |
| `../mobile-webview` | โปรเจกต์นี้ — WebView อย่างเดียว |
| `../web` | เว็บ Vite ที่ deploy แล้ว |

## ความต้องการ

- Node 20+
- Xcode + CocoaPods (iOS)
- Android Studio / SDK (Android)

## ติดตั้ง

```bash
cd mobile-webview
npm install

# iOS
cd ios && bundle install && bundle exec pod install && cd ..
```

## รัน

```bash
# Metro
npm start

# อีกเทอร์มินัล
npm run ios
# หรือ
npm run android
```

## ชี้ไปเว็บ local

แก้ `src/config.ts`:

```ts
export const WEB_BASE_URL = 'http://192.168.x.x:5173'; // เครื่องจริง / iOS sim
// Android emulator:
// export const WEB_BASE_URL = 'http://10.0.2.2:5173';
```

แล้วรัน `npm start` ใน `../web` ด้วย `--host 0.0.0.0`

## สิ่งที่ shell ทำ

- WebView เต็มจอ + progress bar
- Android ปุ่มย้อนกลับ = `goBack()` ในเว็บ
- ลิงก์นอกโดเมนเปิดเบราว์เซอร์ระบบ
- อนุญาต geolocation / camera / photos สำหรับฟีเจอร์เว็บ
