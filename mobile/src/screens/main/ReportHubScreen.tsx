import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {Screen} from '../../components/Screen';
import {AppIcon} from '../../components/AppIcon';
import {GlassView} from '../../components/GlassView';
import {RootStackParamList} from '../../navigation/types';
import {useI18n} from '../../i18n/useI18n';
import {TranslationKey} from '../../i18n/translations';
import {colors, radius, shadow, spacing, typography} from '../../theme';

type Item = {
  icon: string;
  titleKey: TranslationKey;
  descKey: TranslationKey;
  route: 'ReportLost' | 'ReportFound' | 'QRScanner';
  tone: 'danger' | 'success' | 'info';
};

const items: Item[] = [
  {icon: 'alert-circle', titleKey: 'lostMine', descKey: 'lostMineDesc', route: 'ReportLost', tone: 'danger'},
  {icon: 'checkmark-circle', titleKey: 'foundOne', descKey: 'foundOneDesc', route: 'ReportFound', tone: 'success'},
  {icon: 'qr-code-outline', titleKey: 'scanQr', descKey: 'scanQrDesc', route: 'QRScanner', tone: 'info'},
];

export function ReportHubScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const t = useI18n(s => s.t);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>{t('reportHubTitle')}</Text>
        <Text style={styles.subtitle}>{t('reportHubSub')}</Text>
      </View>
      {items.map(item => (
        <Pressable
          key={item.route}
          style={styles.card}
          onPress={() =>
            item.route === 'ReportLost'
              ? navigation.navigate(item.route, {})
              : navigation.navigate(item.route)
          }>
          <View
            style={[
              styles.icon,
              item.tone === 'danger' && {backgroundColor: colors.emergencyMuted},
              item.tone === 'success' && {backgroundColor: colors.primaryMuted},
              item.tone === 'info' && {backgroundColor: colors.secondaryMuted},
            ]}>
            <AppIcon
              name={item.icon}
              size={26}
              color={
                item.tone === 'danger'
                  ? colors.emergency
                  : item.tone === 'success'
                    ? colors.primaryDark
                    : colors.secondary
              }
            />
          </View>
          <View style={{flex: 1, gap: 5}}>
            <Text style={styles.cardTitle}>{t(item.titleKey)}</Text>
            <Text style={styles.desc}>{t(item.descKey)}</Text>
          </View>
          <AppIcon name="chevron-forward" size={20} color={colors.textSecondary} />
        </Pressable>
      ))}
      <GlassView style={styles.tip}>
        <View style={styles.tipHeader}>
          <AppIcon name="bulb-outline" size={20} color={colors.secondary} />
          <Text style={styles.tipTitle}>{t('tipTitle')}</Text>
        </View>
        <Text style={styles.tipText}>{t('tipText')}</Text>
      </GlassView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {gap: 6, marginBottom: spacing.sm},
  title: {fontSize: typography.h1, fontWeight: '900', color: colors.text, letterSpacing: -0.4},
  subtitle: {fontSize: typography.body, color: colors.textSecondary, lineHeight: 23},
  card: {
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
  icon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {fontSize: typography.h3, fontWeight: '900', color: colors.text},
  desc: {fontSize: typography.small, color: colors.textSecondary, lineHeight: 20},
  tip: {borderRadius: radius.lg, padding: spacing.md, gap: 8, backgroundColor: colors.secondaryMuted},
  tipHeader: {flexDirection: 'row', alignItems: 'center', gap: 8},
  tipTitle: {fontWeight: '900', color: colors.text, fontSize: typography.body},
  tipText: {color: colors.textSecondary, fontSize: typography.small, lineHeight: 20},
});
