import React from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {Pet} from '../types/api';
import {AppIcon} from './AppIcon';
import {StatusBadge} from './StatusBadge';
import {useI18n} from '../i18n/useI18n';
import {colors, radius, shadow, spacing, typography} from '../theme';

export function PetCard({pet, onPress}: {pet: Pet; onPress?: () => void}) {
  const t = useI18n(s => s.t);
  const animalLabel =
    pet.animal_type === 'dog' ? t('dog') : pet.animal_type === 'cat' ? t('cat') : t('pet');
  const animalIcon = pet.animal_type === 'dog' ? 'dog' : pet.animal_type === 'cat' ? 'cat' : 'paw';

  return (
    <Pressable onPress={onPress} style={({pressed}) => [styles.card, pressed && {opacity: 0.9}]}>
      {pet.profile_image_url ? (
        <Image source={{uri: pet.profile_image_url}} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.placeholder]}>
          <AppIcon name={animalIcon} set="mci" size={36} color={colors.primaryDark} />
        </View>
      )}
      <View style={styles.info}>
        <View style={styles.row}>
          <Text style={styles.name}>{pet.name}</Text>
          <StatusBadge status={pet.status} />
        </View>
        <Text style={styles.meta}>
          {[pet.breed, pet.color].filter(Boolean).join(' · ') || animalLabel}
        </Text>
        <Text style={styles.code}>{pet.pet_code}</Text>
      </View>
      <AppIcon name="chevron-forward" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.cardSolid,
    borderRadius: radius.lg,
    padding: spacing.sm,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    ...shadow.soft,
  },
  image: {width: 86, height: 86, borderRadius: radius.md},
  placeholder: {backgroundColor: colors.primaryMuted, alignItems: 'center', justifyContent: 'center'},
  info: {flex: 1, justifyContent: 'center', gap: 5},
  row: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8},
  name: {flex: 1, fontSize: typography.h3, fontWeight: '800', color: colors.text},
  meta: {fontSize: typography.small, color: colors.textSecondary},
  code: {fontSize: typography.caption, color: colors.primaryDark, fontWeight: '700'},
});
