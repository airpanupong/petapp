import AsyncStorage from '@react-native-async-storage/async-storage';
import {create} from 'zustand';

import {dictionaries, Locale, TranslationKey} from './translations';

const STORAGE_KEY = 'petapp.locale';

type I18nState = {
  locale: Locale;
  hydrated: boolean;
  setLocale: (locale: Locale) => Promise<void>;
  hydrate: () => Promise<void>;
  t: (key: TranslationKey) => string;
};

export const useI18n = create<I18nState>((set, get) => ({
  locale: 'th',
  hydrated: false,
  t: key => dictionaries[get().locale][key] ?? key,
  setLocale: async locale => {
    set({locale});
    await AsyncStorage.setItem(STORAGE_KEY, locale);
  },
  hydrate: async () => {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved === 'th' || saved === 'en') {
      set({locale: saved, hydrated: true});
      return;
    }
    set({hydrated: true});
  },
}));
