import React, {useState} from 'react';
import {Alert, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {AuthStackParamList} from '../../navigation/types';
import {Screen} from '../../components/Screen';
import {AppInput} from '../../components/AppInput';
import {AppButton} from '../../components/AppButton';
import {AppIcon} from '../../components/AppIcon';
import {GlassView} from '../../components/GlassView';
import {colors, radius, shadow, spacing, typography} from '../../theme';
import {useAuthStore} from '../../store/authStore';
import {useI18n} from '../../i18n/useI18n';
import {getApiErrorMessage} from '../../api/client';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({navigation}: Props) {
  const login = useAuthStore(s => s.login);
  const t = useI18n(s => s.t);
  const locale = useI18n(s => s.locale);
  const setLocale = useI18n(s => s.setLocale);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) {
      Alert.alert(t('incompleteTitle'), t('incompleteLogin'));
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (error) {
      Alert.alert(t('loginFailed'), getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen contentStyle={styles.content} paddedBottom={false}>
      <View style={styles.langRow}>
        <AppButton
          title={locale === 'th' ? 'EN' : 'TH'}
          variant="ghost"
          onPress={() => void setLocale(locale === 'th' ? 'en' : 'th')}
          style={styles.langBtn}
        />
      </View>
      <View style={styles.hero}>
        <View style={styles.pawBubble}>
          <AppIcon name="paw" size={40} color={colors.primaryDark} />
        </View>
        <Text style={styles.title}>{t('welcome')}</Text>
        <Text style={styles.subtitle}>{t('welcomeSub')}</Text>
      </View>
      <GlassView intensity="strong" style={styles.card}>
        <AppInput
          label={t('email')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <AppInput
          label={t('password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
        />
        <AppButton title={t('login')} icon="log-in-outline" onPress={submit} loading={loading} />
        <AppButton
          title={t('createAccount')}
          variant="outline"
          icon="person-add-outline"
          onPress={() => navigation.navigate('Register')}
        />
      </GlassView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {flexGrow: 1, justifyContent: 'center', padding: spacing.lg},
  langRow: {alignItems: 'flex-end'},
  langBtn: {minHeight: 40, paddingHorizontal: 14, shadowOpacity: 0, elevation: 0},
  hero: {alignItems: 'center', gap: 8, marginBottom: spacing.md},
  pawBubble: {
    width: 94,
    height: 94,
    borderRadius: 47,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.soft,
  },
  title: {fontSize: typography.display, fontWeight: '900', color: colors.text, letterSpacing: -0.8},
  subtitle: {fontSize: typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 24},
  card: {borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md},
});
