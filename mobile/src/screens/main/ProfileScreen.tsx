import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {Screen} from '../../components/Screen';
import {AppButton} from '../../components/AppButton';
import {AppIcon} from '../../components/AppIcon';
import {GlassView} from '../../components/GlassView';
import {useAuthStore} from '../../store/authStore';
import {RootStackParamList} from '../../navigation/types';
import {useI18n} from '../../i18n/useI18n';
import {Locale, TranslationKey} from '../../i18n/translations';
import {colors, radius, shadow, spacing, typography} from '../../theme';

const menu: {
  icon: string;
  titleKey: TranslationKey;
  descKey: TranslationKey;
  route: keyof RootStackParamList;
}[] = [
  {icon: 'create-outline', titleKey: 'menuEditProfile', descKey: 'menuEditProfileDesc', route: 'EditProfile'},
  {icon: 'documents-outline', titleKey: 'menuMyPosts', descKey: 'menuMyPostsDesc', route: 'MyPosts'},
  {icon: 'chatbubbles-outline', titleKey: 'menuChat', descKey: 'menuChatDesc', route: 'ChatList'},
  {icon: 'notifications-outline', titleKey: 'menuNotifications', descKey: 'menuNotificationsDesc', route: 'Notifications'},
  {icon: 'megaphone-outline', titleKey: 'menuAlerts', descKey: 'menuAlertsDesc', route: 'LostAlerts'},
  {icon: 'shield-checkmark-outline', titleKey: 'menuPrivacy', descKey: 'menuPrivacyDesc', route: 'Privacy'},
  {icon: 'pricetag-outline', titleKey: 'menuAds', descKey: 'menuAdsDesc', route: 'SponsoredAds'},
  {icon: 'qr-code-outline', titleKey: 'menuScan', descKey: 'menuScanDesc', route: 'QRScanner'},
];

export function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);
  const t = useI18n(s => s.t);
  const locale = useI18n(s => s.locale);
  const setLocale = useI18n(s => s.setLocale);

  const items = [
    ...menu,
    ...(user?.role === 'admin'
      ? [
          {
            icon: 'construct-outline',
            titleKey: 'menuAdmin' as TranslationKey,
            descKey: 'menuAdminDesc' as TranslationKey,
            route: 'Admin' as keyof RootStackParamList,
          },
        ]
      : []),
  ];

  return (
    <Screen>
      <Pressable onPress={() => navigation.navigate('EditProfile')}>
        <GlassView intensity="strong" style={styles.profile}>
          <View style={styles.avatar}>
            <AppIcon name="person" size={32} color={colors.secondary} />
          </View>
          <View style={{flex: 1}}>
            <Text style={styles.name}>{user?.display_name}</Text>
            <Text style={styles.email}>{user?.email}</Text>
            {!!user?.phone && <Text style={styles.email}>{user.phone}</Text>}
          </View>
          <AppIcon name="chevron-forward" size={18} color={colors.textSecondary} />
        </GlassView>
      </Pressable>

      <View style={styles.langCard}>
        <Text style={styles.langLabel}>{t('language')}</Text>
        <View style={styles.langRow}>
          {(['th', 'en'] as Locale[]).map(code => (
            <Pressable
              key={code}
              onPress={() => void setLocale(code)}
              style={[styles.langBtn, locale === code && styles.langBtnActive]}>
              <Text style={[styles.langText, locale === code && styles.langTextActive]}>
                {code === 'th' ? t('languageTh') : t('languageEn')}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {items.map(item => (
        <Pressable
          key={item.route}
          style={styles.menu}
          onPress={() => navigation.navigate(item.route as never)}>
          <View style={styles.menuIcon}>
            <AppIcon name={item.icon} size={20} color={colors.primaryDark} />
          </View>
          <View style={{flex: 1}}>
            <Text style={styles.menuTitle}>{t(item.titleKey)}</Text>
            <Text style={styles.menuDesc}>{t(item.descKey)}</Text>
          </View>
          <AppIcon name="chevron-forward" size={18} color={colors.textSecondary} />
        </Pressable>
      ))}

      <GlassView style={styles.tip}>
        <Text style={styles.tipTitle}>{t('tipGuardian')}</Text>
        <Text style={styles.menuDesc}>{t('tipGuardianDesc')}</Text>
      </GlassView>

      <AppButton title={t('logout')} variant="outline" icon="log-out-outline" onPress={() => void logout()} />
      <Text style={styles.version}>{t('version')}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.secondaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {fontSize: typography.h2, fontWeight: '900', color: colors.text},
  email: {fontSize: typography.small, color: colors.textSecondary, marginTop: 4},
  langCard: {
    backgroundColor: colors.cardSolid,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    ...shadow.soft,
  },
  langLabel: {fontWeight: '800', color: colors.text},
  langRow: {flexDirection: 'row', gap: 8},
  langBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.backgroundAlt,
    alignItems: 'center',
  },
  langBtnActive: {backgroundColor: colors.primary},
  langText: {fontWeight: '700', color: colors.textSecondary},
  langTextActive: {color: colors.textInverse},
  menu: {
    backgroundColor: colors.cardSolid,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.soft,
  },
  menuIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTitle: {fontWeight: '800', fontSize: typography.body, color: colors.text},
  menuDesc: {fontSize: typography.caption, color: colors.textSecondary, marginTop: 3, lineHeight: 18},
  tip: {borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.primaryMuted},
  tipTitle: {fontWeight: '900', color: colors.primaryDark, marginBottom: 4},
  version: {fontSize: typography.caption, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm},
});
