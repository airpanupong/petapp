import React, {useEffect} from 'react';
import {Linking, StyleSheet, Text, View} from 'react-native';
import {useQuery} from '@tanstack/react-query';

import {listAds} from '../../api/community.api';
import {trackAdEvent} from '../../api/features.api';
import {Screen} from '../../components/Screen';
import {AdCard} from '../../components/AdCard';
import {AppButton} from '../../components/AppButton';
import {EmptyState} from '../../components/EmptyState';
import {useI18n} from '../../i18n/useI18n';
import {colors, radius, shadow, spacing, typography} from '../../theme';

export function SponsoredAdsScreen() {
  const t = useI18n(s => s.t);
  const q = useQuery({queryKey: ['ads'], queryFn: listAds});

  useEffect(() => {
    q.data?.forEach(a => void trackAdEvent(a.id, 'impression').catch(() => undefined));
  }, [q.data]);

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.title}>{t('menuAds')}</Text>
        <Text style={styles.desc}>{t('menuAdsDesc')}</Text>
      </View>
      {q.data?.map(a => (
        <View key={a.id} style={{gap: 8}}>
          <AdCard ad={a} />
          {!!a.target_url && (
            <AppButton
              title={t('viewDetails')}
              variant="outline"
              icon="open-outline"
              onPress={() =>
                void trackAdEvent(a.id, 'click').finally(() => Linking.openURL(a.target_url!))
              }
            />
          )}
        </View>
      ))}
      {!q.isLoading && !q.data?.length && (
        <EmptyState icon="storefront-outline" title={t('noNewPosts')} description={t('menuAdsDesc')} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.secondaryMuted,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.soft,
  },
  title: {fontSize: typography.h2, fontWeight: '900', color: colors.text},
  desc: {fontSize: typography.small, color: colors.textSecondary, lineHeight: 20},
});
