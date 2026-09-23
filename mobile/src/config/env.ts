import {Platform} from 'react-native';

/** Railway production API. For local Docker backend, use Platform URLs below. */
const RAILWAY_API = 'https://api-production-6009.up.railway.app/api/v1';
const USE_RAILWAY = true;

export const API_BASE_URL = USE_RAILWAY
  ? RAILWAY_API
  : Platform.select({
      android: 'http://10.0.2.2:8000/api/v1',
      ios: 'http://127.0.0.1:8000/api/v1',
      default: 'http://localhost:8000/api/v1',
    })!;

export const PUBLIC_PET_WEB_BASE = 'https://petapp.example/p';

export const PUBLIC_SHARE_BASE = 'https://petapp.example';
