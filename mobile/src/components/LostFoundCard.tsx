import React from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {FoundPost, LostPost} from '../types/api';
import {resolveMediaUrl} from '../api/uploads.api';
import {AppIcon} from './AppIcon';
import {useI18n} from '../i18n/useI18n';
import {colors, radius, shadow, spacing, typography} from '../theme';

export function LostCard({post, onPress}: {post: LostPost; onPress?: () => void}) {
  const t = useI18n(s => s.t);
  const imageUri = resolveMediaUrl(post.image_url) || resolveMediaUrl(post.pet?.profile_image_url);
  return (
    <Pressable onPress={onPress} style={styles.card}>
      {imageUri ? (
        <Image source={{uri: imageUri}} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.lostPlaceholder]}>
          <AppIcon name="paw" size={32} color={colors.emergency} />
        </View>
      )}
      <View style={styles.body}>
        <View style={styles.row}>
          <Text style={styles.title}>{post.pet?.name ?? post.title}</Text>
          <Text style={styles.lost}>{t('statusLost')}</Text>
        </View>
        <Text style={styles.meta}>
          {post.pet?.breed || post.pet?.animal_type || t('pet')} · {post.pet?.color || t('unspecifiedColor')}
        </Text>
        <View style={styles.locRow}>
          <AppIcon name="location-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.location}>
            {post.location_text || t('mapLocation')}
            {post.distance_km != null ? ` · ${post.distance_km} km` : ''}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export function FoundCard({post, onPress}: {post: FoundPost; onPress?: () => void}) {
  const t = useI18n(s => s.t);
  const animalLabel =
    post.animal_type === 'dog' ? t('dog') : post.animal_type === 'cat' ? t('cat') : t('pet');
  const imageUri = resolveMediaUrl(post.image_url);
  return (
    <Pressable onPress={onPress} style={styles.card}>
      {imageUri ? (
        <Image source={{uri: imageUri}} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.foundPlaceholder]}>
          <AppIcon
            name={post.animal_type === 'dog' ? 'dog' : post.animal_type === 'cat' ? 'cat' : 'paw'}
            set="mci"
            size={32}
            color={colors.primaryDark}
          />
        </View>
      )}
      <View style={styles.body}>
        <View style={styles.row}>
          <Text style={styles.title}>
            {t('foundLegend')} {animalLabel}
          </Text>
          <Text style={styles.found}>{t('foundLabel')}</Text>
        </View>
        <Text style={styles.meta}>
          {[post.breed_guess, post.color].filter(Boolean).join(' · ') || t('awaitingOwner')}
        </Text>
        <View style={styles.locRow}>
          <AppIcon name="location-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.location}>
            {post.location_text || t('mapLocation')}
            {post.distance_km != null ? ` · ${post.distance_km} km` : ''}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.cardSolid,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.soft,
  },
  image: {width: 98, height: 104},
  lostPlaceholder: {backgroundColor: colors.emergencyMuted, alignItems: 'center', justifyContent: 'center'},
  foundPlaceholder: {backgroundColor: colors.primaryMuted, alignItems: 'center', justifyContent: 'center'},
  body: {flex: 1, padding: spacing.sm, gap: 6, justifyContent: 'center'},
  row: {flexDirection: 'row', justifyContent: 'space-between', gap: 8},
  title: {fontSize: typography.body, fontWeight: '800', color: colors.text, flex: 1},
  lost: {color: colors.emergency, fontWeight: '800', fontSize: typography.caption},
  found: {color: colors.primaryDark, fontWeight: '800', fontSize: typography.caption},
  meta: {fontSize: typography.small, color: colors.textSecondary},
  locRow: {flexDirection: 'row', alignItems: 'center', gap: 4},
  location: {fontSize: typography.caption, color: colors.textSecondary, flex: 1},
});
