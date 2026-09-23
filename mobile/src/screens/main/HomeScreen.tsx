import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useQuery} from '@tanstack/react-query';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {Screen} from '../../components/Screen';
import {SectionHeader} from '../../components/SectionHeader';
import {LostCard, FoundCard} from '../../components/LostFoundCard';
import {AdCard} from '../../components/AdCard';
import {EmptyState} from '../../components/EmptyState';
import {AppButton} from '../../components/AppButton';
import {AppIcon} from '../../components/AppIcon';
import {GlassView} from '../../components/GlassView';
import {listAds, listFoundPosts, listLostPosts} from '../../api/community.api';
import {RootStackParamList} from '../../navigation/types';
import {useI18n} from '../../i18n/useI18n';
import {colors, radius, shadow, spacing, typography} from '../../theme';
import {useAuthStore} from '../../store/authStore';

export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const user = useAuthStore(s => s.user);
  const t = useI18n(s => s.t);
  const lost = useQuery({queryKey: ['lost-posts'], queryFn: listLostPosts});
  const found = useQuery({queryKey: ['found-posts'], queryFn: listFoundPosts});
  const ads = useQuery({queryKey: ['ads'], queryFn: listAds});

  return (
    <Screen>
      <View style={styles.header}>
        <View style={{flex: 1}}>
          <Text style={styles.greeting}>
            {t('greeting')} {user?.display_name ?? t('friendDefault')}
          </Text>
          <Text style={styles.sub}>{t('homeSub')}</Text>
        </View>
        <Pressable style={styles.avatar} onPress={() => navigation.navigate('Notifications')}>
          <AppIcon name="notifications-outline" size={22} color={colors.primaryDark} />
        </Pressable>
      </View>

      <GlassView intensity="strong" style={styles.hero}>
        <View style={{flex: 1, gap: 8}}>
          <Text style={styles.heroTitle}>{t('heroTitle')}</Text>
          <Text style={styles.heroText}>{t('heroText')}</Text>
        </View>
        <View style={styles.heroIcon}>
          <AppIcon name="home" size={34} color={colors.secondary} />
        </View>
      </GlassView>

      <View style={styles.actions}>
        <AppButton
          title={t('reportLost')}
          icon="alert-circle"
          variant="danger"
          onPress={() => navigation.navigate('ReportLost', {})}
          style={styles.actionButton}
        />
        <AppButton
          title={t('reportFound')}
          icon="checkmark-circle"
          onPress={() => navigation.navigate('ReportFound')}
          style={styles.actionButton}
        />
      </View>
      <View style={styles.actions}>
        <AppButton
          title={t('lostAlert')}
          icon="megaphone-outline"
          variant="outline"
          onPress={() => navigation.navigate('LostAlerts')}
          style={styles.actionButton}
        />
        <AppButton
          title={t('notifications')}
          icon="notifications-outline"
          variant="ghost"
          onPress={() => navigation.navigate('Notifications')}
          style={styles.actionButton}
        />
      </View>

      <SectionHeader title={t('seeking')} />
      {lost.isLoading ? (
        <Text style={styles.loading}>{t('loading')}</Text>
      ) : lost.data?.length ? (
        lost.data.slice(0, 4).map(post => (
          <LostCard
            key={post.id}
            post={post}
            onPress={() => navigation.navigate('LostPostDetail', {postId: post.id})}
          />
        ))
      ) : (
        <EmptyState icon="home-outline" title={t('noLostPosts')} description={t('noLostDesc')} />
      )}

      {!!ads.data?.[0] && <AdCard ad={ads.data[0]} />}

      <SectionHeader title={t('foundPets')} />
      {found.data?.length ? (
        found.data.slice(0, 3).map(post => (
          <FoundCard
            key={post.id}
            post={post}
            onPress={() => navigation.navigate('FoundPostDetail', {postId: post.id})}
          />
        ))
      ) : (
        <Text style={styles.muted}>{t('noNewPosts')}</Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md},
  greeting: {fontSize: typography.h2, fontWeight: '900', color: colors.text, letterSpacing: -0.3},
  sub: {fontSize: typography.small, color: colors.textSecondary, marginTop: 4},
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  hero: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.secondaryMuted,
  },
  heroTitle: {fontSize: typography.h1, fontWeight: '900', color: colors.text, letterSpacing: -0.4},
  heroText: {fontSize: typography.small, color: colors.textSecondary, lineHeight: 20},
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: colors.cardSolid,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.soft,
  },
  actions: {flexDirection: 'row', gap: spacing.sm},
  actionButton: {flex: 1},
  loading: {color: colors.textSecondary},
  muted: {color: colors.textSecondary, textAlign: 'center', paddingVertical: spacing.md},
});
