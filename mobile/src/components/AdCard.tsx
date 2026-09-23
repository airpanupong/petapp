import React from 'react';
import {Image, StyleSheet, Text, View} from 'react-native';
import {Ad} from '../types/api';
import {AppIcon} from './AppIcon';
import {useI18n} from '../i18n/useI18n';
import {colors, radius, shadow, spacing, typography} from '../theme';

export function AdCard({ad}: {ad: Ad}) {
  const t = useI18n(s => s.t);
  return (
    <View style={styles.card}>
      {ad.image_url ? (
        <Image source={{uri: ad.image_url}} style={styles.image} />
      ) : (
        <View style={styles.imageFallback}>
          <AppIcon name="storefront-outline" size={28} color={colors.secondary} />
        </View>
      )}
      <View style={styles.body}>
        <Text style={styles.sponsored}>
          {t('sponsored')} · {ad.advertiser_name}
        </Text>
        <Text style={styles.title}>{ad.title}</Text>
        <Text style={styles.description} numberOfLines={2}>
          {ad.description}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.secondaryMuted,
    borderRadius: radius.lg,
    padding: spacing.sm,
    flexDirection: 'row',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.soft,
  },
  image: {width: 72, height: 72, borderRadius: radius.md},
  imageFallback: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    backgroundColor: colors.cardSolid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {flex: 1, gap: 3, justifyContent: 'center'},
  sponsored: {fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase', fontWeight: '700'},
  title: {fontSize: typography.small, fontWeight: '800', color: colors.text},
  description: {fontSize: typography.caption, color: colors.textSecondary},
});
