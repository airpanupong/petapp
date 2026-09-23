import React, {useState} from 'react';
import {Alert, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {AuthStackParamList} from '../../navigation/types';
import {Screen} from '../../components/Screen';
import {AppInput} from '../../components/AppInput';
import {AppButton} from '../../components/AppButton';
import {GlassView} from '../../components/GlassView';
import {colors, radius, spacing, typography} from '../../theme';
import {useAuthStore} from '../../store/authStore';
import {useI18n} from '../../i18n/useI18n';
import {getApiErrorMessage} from '../../api/client';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export function RegisterScreen({navigation}: Props) {
  const register = useAuthStore(s => s.register);
  const t = useI18n(s => s.t);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!name.trim() || !email.trim() || password.length < 8) {
      Alert.alert(t('checkData'), t('registerValidation'));
      return;
    }
    setLoading(true);
    try {
      await register(name.trim(), email.trim(), password);
    } catch (error) {
      Alert.alert(t('registerFailed'), getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen contentStyle={styles.content} paddedBottom={false}>
      <Text style={styles.title}>{t('registerTitle')}</Text>
      <Text style={styles.subtitle}>{t('registerSub')}</Text>
      <GlassView intensity="strong" style={styles.card}>
        <AppInput label={t('displayName')} value={name} onChangeText={setName} />
        <AppInput
          label={t('email')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <AppInput label={t('password')} value={password} onChangeText={setPassword} secureTextEntry />
        <AppButton title={t('register')} icon="checkmark-circle" onPress={submit} loading={loading} />
        <AppButton title={t('backToLogin')} variant="outline" icon="arrow-back" onPress={() => navigation.goBack()} />
      </GlassView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {flexGrow: 1, justifyContent: 'center', padding: spacing.lg},
  title: {fontSize: typography.h1, fontWeight: '900', color: colors.text, textAlign: 'center', letterSpacing: -0.4},
  subtitle: {
    fontSize: typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.sm,
  },
  card: {borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md},
});
