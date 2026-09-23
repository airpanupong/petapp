import React, {useEffect, useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import MapView, {Marker, Region} from 'react-native-maps';
import {useQuery} from '@tanstack/react-query';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {Screen} from '../../components/Screen';
import {LostCard, FoundCard} from '../../components/LostFoundCard';
import {GlassView} from '../../components/GlassView';
import {AppIcon} from '../../components/AppIcon';
import {getNearby} from '../../api/community.api';
import {getCurrentCoordinates} from '../../services/location';
import {useI18n} from '../../i18n/useI18n';
import {colors, radius, shadow, spacing, typography} from '../../theme';
import {RootStackParamList} from '../../navigation/types';

const BANGKOK = {latitude: 13.7563, longitude: 100.5018};
type Animal = 'all' | 'dog' | 'cat';
type PostFilter = 'all' | 'lost' | 'found' | 'sighting';

export function NearbyScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const t = useI18n(s => s.t);
  const [coords, setCoords] = useState(BANGKOK);
  const [mode, setMode] = useState<'map' | 'feed'>('map');
  const [radiusKm, setRadiusKm] = useState(5);
  const [animal, setAnimal] = useState<Animal>('all');
  const [postFilter, setPostFilter] = useState<PostFilter>('all');
  const [days, setDays] = useState<number | undefined>(7);

  useEffect(() => {
    void getCurrentCoordinates().then(setCoords).catch(() => undefined);
  }, []);

  const nearby = useQuery({
    queryKey: ['nearby', coords.latitude, coords.longitude, radiusKm, animal, postFilter, days],
    queryFn: () =>
      getNearby({
        ...coords,
        radius_km: radiusKm,
        animal_type: animal === 'all' ? undefined : animal,
        post_type: postFilter === 'all' ? undefined : postFilter,
        days,
      }),
  });

  const region: Region = useMemo(
    () => ({
      ...coords,
      latitudeDelta: radiusKm / 55,
      longitudeDelta: radiusKm / 55,
    }),
    [coords, radiusKm],
  );

  const showLost = postFilter === 'all' || postFilter === 'lost';
  const showFound = postFilter === 'all' || postFilter === 'found';
  const showSighting = postFilter === 'all' || postFilter === 'sighting';

  return (
    <Screen scroll={mode === 'feed'} contentStyle={mode === 'map' ? styles.mapScreen : undefined}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t('nearbyTitle')}</Text>
          <Text style={styles.subtitle}>
            {t('nearbySub')} {radiusKm} km
          </Text>
        </View>
        <GlassView style={styles.switcher}>
          <Pressable onPress={() => setMode('map')} style={[styles.switchBtn, mode === 'map' && styles.switchActive]}>
            <AppIcon name="map-outline" size={14} color={mode === 'map' ? colors.primaryDark : colors.textSecondary} />
            <Text style={[styles.switchText, mode === 'map' && styles.switchTextActive]}>{t('map')}</Text>
          </Pressable>
          <Pressable onPress={() => setMode('feed')} style={[styles.switchBtn, mode === 'feed' && styles.switchActive]}>
            <AppIcon name="list-outline" size={14} color={mode === 'feed' ? colors.primaryDark : colors.textSecondary} />
            <Text style={[styles.switchText, mode === 'feed' && styles.switchTextActive]}>{t('list')}</Text>
          </Pressable>
        </GlassView>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {([1, 3, 5, 10] as const).map(value => (
          <Chip key={`r${value}`} active={radiusKm === value} label={`${value} km`} onPress={() => setRadiusKm(value)} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        <Chip active={animal === 'all'} label="ทั้งหมด" onPress={() => setAnimal('all')} />
        <Chip active={animal === 'dog'} label={t('dog')} onPress={() => setAnimal('dog')} />
        <Chip active={animal === 'cat'} label={t('cat')} onPress={() => setAnimal('cat')} />
        <Chip active={postFilter === 'all'} label="ทุกประเภท" onPress={() => setPostFilter('all')} />
        <Chip active={postFilter === 'lost'} label={t('lostLegend')} onPress={() => setPostFilter('lost')} />
        <Chip active={postFilter === 'found'} label={t('foundLegend')} onPress={() => setPostFilter('found')} />
        <Chip active={postFilter === 'sighting'} label="เบาะแส" onPress={() => setPostFilter('sighting')} />
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {([
          [1, 'วันนี้'],
          [3, '3 วัน'],
          [7, '7 วัน'],
          [30, '30 วัน'],
        ] as const).map(([d, label]) => (
          <Chip key={d} active={days === d} label={label} onPress={() => setDays(d)} />
        ))}
      </ScrollView>

      {mode === 'map' ? (
        <View style={styles.mapWrap}>
          <MapView style={StyleSheet.absoluteFill} region={region} showsUserLocation>
            {showLost &&
              nearby.data?.lost.map(post => (
                <Marker
                  key={`lost-${post.id}`}
                  coordinate={{latitude: post.latitude, longitude: post.longitude}}
                  title={post.pet?.name || t('statusLost')}
                  description={post.location_text || undefined}
                  pinColor={colors.emergency}
                  onCalloutPress={() => navigation.navigate('LostPostDetail', {postId: post.id})}
                />
              ))}
            {showFound &&
              nearby.data?.found.map(post => (
                <Marker
                  key={`found-${post.id}`}
                  coordinate={{latitude: post.latitude, longitude: post.longitude}}
                  title={t('foundMarker')}
                  description={post.location_text || undefined}
                  pinColor={colors.primary}
                  onCalloutPress={() => navigation.navigate('FoundPostDetail', {postId: post.id})}
                />
              ))}
            {showSighting &&
              nearby.data?.sightings?.map(s => (
                <Marker
                  key={`sight-${s.id}`}
                  coordinate={{latitude: s.latitude, longitude: s.longitude}}
                  title={s.pet_name ? `เห็น ${s.pet_name}` : 'เบาะแส'}
                  description={s.location_text || undefined}
                  pinColor={colors.warning}
                  onCalloutPress={() => navigation.navigate('LostPostDetail', {postId: s.lost_post_id})}
                />
              ))}
          </MapView>
          <GlassView style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.dot, {backgroundColor: colors.emergency}]} />
              <Text style={styles.legendText}>{t('lostLegend')}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.dot, {backgroundColor: colors.primary}]} />
              <Text style={styles.legendText}>{t('foundLegend')}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.dot, {backgroundColor: colors.warning}]} />
              <Text style={styles.legendText}>เบาะแส</Text>
            </View>
          </GlassView>
        </View>
      ) : (
        <>
          {showLost && (
            <>
              <Text style={styles.section}>{t('seeking')}</Text>
              {nearby.data?.lost.map(post => (
                <LostCard
                  key={post.id}
                  post={post}
                  onPress={() => navigation.navigate('LostPostDetail', {postId: post.id})}
                />
              ))}
            </>
          )}
          {showFound && (
            <>
              <Text style={styles.section}>{t('foundPets')}</Text>
              {nearby.data?.found.map(post => (
                <FoundCard
                  key={post.id}
                  post={post}
                  onPress={() => navigation.navigate('FoundPostDetail', {postId: post.id})}
                />
              ))}
            </>
          )}
          {showSighting && (
            <>
              <Text style={styles.section}>เบาะแสใกล้ฉัน</Text>
              {nearby.data?.sightings?.map(s => (
                <Pressable
                  key={s.id}
                  style={styles.sightCard}
                  onPress={() => navigation.navigate('LostPostDetail', {postId: s.lost_post_id})}>
                  <Text style={styles.sightTitle}>👀 {s.pet_name || 'เบาะแส'}</Text>
                  <Text style={styles.sightMeta}>
                    {s.location_text || 'จุดที่พบเห็น'}
                    {s.distance_km != null ? ` · ${s.distance_km} km` : ''}
                  </Text>
                </Pressable>
              ))}
            </>
          )}
          {!nearby.isLoading &&
            !nearby.data?.lost.length &&
            !nearby.data?.found.length &&
            !nearby.data?.sightings?.length && <Text style={styles.empty}>{t('emptyNearby')}</Text>}
        </>
      )}
    </Screen>
  );
}

function Chip({active, label, onPress}: {active: boolean; label: string; onPress: () => void}) {
  return (
    <Pressable onPress={onPress} style={[styles.radiusChip, active && styles.radiusChipActive]}>
      <Text style={[styles.radiusText, active && styles.radiusTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  mapScreen: {flex: 1, gap: spacing.md},
  header: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md},
  title: {fontSize: typography.h1, fontWeight: '900', color: colors.text, letterSpacing: -0.4},
  subtitle: {fontSize: typography.small, color: colors.textSecondary, marginTop: 4},
  switcher: {flexDirection: 'row', borderRadius: radius.full, padding: 4},
  switchBtn: {flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.full},
  switchActive: {backgroundColor: colors.primaryMuted},
  switchText: {fontSize: 12, fontWeight: '700', color: colors.textSecondary},
  switchTextActive: {color: colors.primaryDark},
  filterRow: {gap: 8, paddingRight: 8},
  radiusChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.cardSolid,
    borderWidth: 1,
    borderColor: colors.border,
  },
  radiusChipActive: {backgroundColor: colors.primary, borderColor: colors.primary},
  radiusText: {fontWeight: '700', color: colors.textSecondary, fontSize: 12},
  radiusTextActive: {color: colors.textInverse},
  mapWrap: {flex: 1, borderRadius: radius.xl, overflow: 'hidden', minHeight: 360, ...shadow.soft},
  legend: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
  },
  legendItem: {flexDirection: 'row', alignItems: 'center', gap: 6},
  dot: {width: 8, height: 8, borderRadius: 4},
  legendText: {fontSize: 12, fontWeight: '700', color: colors.text},
  section: {fontSize: typography.h3, fontWeight: '800', color: colors.text},
  empty: {color: colors.textSecondary, textAlign: 'center', paddingVertical: spacing.xl},
  sightCard: {
    backgroundColor: colors.cardSolid,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  sightTitle: {fontWeight: '900', color: colors.text},
  sightMeta: {color: colors.textSecondary, fontSize: typography.small},
});
