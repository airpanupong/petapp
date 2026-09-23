import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useQuery} from '@tanstack/react-query';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {Screen} from '../../components/Screen';
import {PetCard} from '../../components/PetCard';
import {EmptyState} from '../../components/EmptyState';
import {AppButton} from '../../components/AppButton';
import {listPets} from '../../api/pets.api';
import {RootStackParamList} from '../../navigation/types';
import {useI18n} from '../../i18n/useI18n';
import {colors, radius, typography} from '../../theme';

export function MyPetsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const t = useI18n(s => s.t);
  const pets = useQuery({queryKey: ['pets'], queryFn: listPets});

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t('myPetsTitle')}</Text>
          <Text style={styles.subtitle}>{t('myPetsSub')}</Text>
        </View>
        <View style={styles.count}>
          <Text style={styles.countText}>{pets.data?.length ?? 0}</Text>
        </View>
      </View>
      <AppButton title={t('addPet')} icon="add" onPress={() => navigation.navigate('CreatePet')} />
      {pets.data?.length ? (
        pets.data.map(pet => (
          <PetCard
            key={pet.id}
            pet={pet}
            onPress={() => navigation.navigate('PetDetail', {petId: pet.id})}
          />
        ))
      ) : !pets.isLoading ? (
        <EmptyState icon="paw" title={t('noPets')} description={t('noPetsDesc')} />
      ) : (
        <Text style={styles.subtitle}>{t('loading')}</Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  title: {fontSize: typography.h1, fontWeight: '900', color: colors.text, letterSpacing: -0.4},
  subtitle: {fontSize: typography.small, color: colors.textSecondary, marginTop: 4},
  count: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {color: colors.primaryDark, fontWeight: '900', fontSize: 18},
});
