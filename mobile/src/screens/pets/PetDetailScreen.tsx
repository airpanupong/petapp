import React from 'react';
import {Alert, Image, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {RootStackParamList} from '../../navigation/types';
import {
  addPetImage,
  deletePetImage,
  getPet,
  listPetImages,
  setPrimaryPetImage,
} from '../../api/pets.api';
import {getOwnershipVerification} from '../../api/features.api';
import {LocalImage, resolveMediaUrl, uploadImage} from '../../api/uploads.api';
import {getApiErrorMessage} from '../../api/client';
import {Screen} from '../../components/Screen';
import {AppButton} from '../../components/AppButton';
import {StatusBadge} from '../../components/StatusBadge';
import {PhotoPicker} from '../../components/PhotoPicker';
import {AppIcon} from '../../components/AppIcon';
import {colors, radius, spacing, typography} from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'PetDetail'>;

export function PetDetailScreen({route, navigation}: Props) {
  const petId = route.params.petId;
  const qc = useQueryClient();
  const pet = useQuery({queryKey: ['pet', petId], queryFn: () => getPet(petId)});
  const verification = useQuery({
    queryKey: ['ownership', petId],
    queryFn: () => getOwnershipVerification(petId),
  });
  const images = useQuery({queryKey: ['pet-images', petId], queryFn: () => listPetImages(petId)});
  const [pending, setPending] = React.useState<LocalImage[]>([]);

  const refresh = () => {
    void qc.invalidateQueries({queryKey: ['pet', petId]});
    void qc.invalidateQueries({queryKey: ['pet-images', petId]});
    void qc.invalidateQueries({queryKey: ['pets']});
  };

  const upload = useMutation({
    mutationFn: async (photo: LocalImage) => {
      const url = await uploadImage(photo);
      return addPetImage(petId, {image_url: url, is_primary: !(images.data?.length)});
    },
    onSuccess: () => {
      setPending([]);
      refresh();
    },
    onError: e => Alert.alert('อัปโหลดไม่สำเร็จ', getApiErrorMessage(e)),
  });

  if (!pet.data) {
    return (
      <Screen>
        <Text style={{color: colors.textSecondary}}>กำลังโหลด...</Text>
      </Screen>
    );
  }
  const p = pet.data;

  return (
    <Screen>
      <View style={styles.hero}>
        {resolveMediaUrl(p.profile_image_url) ? (
          <Image source={{uri: resolveMediaUrl(p.profile_image_url)}} style={styles.avatarImg} />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.emoji}>{p.animal_type === 'dog' ? '🐶' : p.animal_type === 'cat' ? '🐱' : '🐾'}</Text>
          </View>
        )}
        <Text style={styles.name}>
          {p.name} {verification.data?.status === 'verified' ? '✅' : ''}
        </Text>
        <Text style={styles.code}>{p.pet_code}</Text>
        <StatusBadge status={p.status} />
      </View>

      <Text style={styles.galleryTitle}>แกลเลอรีรูป</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>
        {images.data?.map(img => {
          const uri = resolveMediaUrl(img.image_url);
          return (
            <View key={img.id} style={styles.thumbWrap}>
              {uri ? <Image source={{uri}} style={styles.thumb} /> : null}
              {img.is_primary && (
                <View style={styles.primaryBadge}>
                  <Text style={styles.primaryText}>หลัก</Text>
                </View>
              )}
              <View style={styles.thumbActions}>
                {!img.is_primary && (
                  <Pressable
                    onPress={() =>
                      void setPrimaryPetImage(petId, img.id).then(refresh).catch(e => Alert.alert(getApiErrorMessage(e)))
                    }>
                    <AppIcon name="star-outline" size={16} color="#fff" />
                  </Pressable>
                )}
                <Pressable
                  onPress={() =>
                    Alert.alert('ลบรูป?', undefined, [
                      {text: 'ยกเลิก'},
                      {
                        text: 'ลบ',
                        style: 'destructive',
                        onPress: () =>
                          void deletePetImage(petId, img.id)
                            .then(refresh)
                            .catch(e => Alert.alert(getApiErrorMessage(e))),
                      },
                    ])
                  }>
                  <AppIcon name="trash-outline" size={16} color="#fff" />
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>
      <PhotoPicker
        images={pending}
        onChange={next => {
          setPending(next);
          if (next[0]) upload.mutate(next[0]);
        }}
        max={1}
        label="เพิ่มรูปสัตว์"
      />

      <View style={styles.card}>
        <Info label="ประเภท" value={p.animal_type} />
        <Info label="สายพันธุ์" value={p.breed || '-'} />
        <Info label="สี / ลาย" value={p.color || '-'} />
        <Info label="เพศ" value={p.gender || '-'} />
        <Info label="Microchip" value={p.microchip_id || '-'} />
        <Info label="ตำหนิ" value={p.distinctive_marks || '-'} />
      </View>
      {!!p.emergency_note && (
        <View style={styles.emergency}>
          <Text style={styles.emergencyTitle}>⚠️ ข้อมูลฉุกเฉิน</Text>
          <Text style={styles.emergencyText}>{p.emergency_note}</Text>
        </View>
      )}
      <View style={styles.grid}>
        <AppButton title="✏️ แก้ไข" variant="outline" onPress={() => navigation.navigate('EditPet', {petId: p.id})} style={styles.half} />
        <AppButton title="🔳 Pet QR" onPress={() => navigation.navigate('PetQR', {petId: p.id})} style={styles.half} />
        <AppButton title="🩺 สุขภาพ" variant="outline" onPress={() => navigation.navigate('PetHealth', {petId: p.id})} style={styles.half} />
        <AppButton title="🚑 ฉุกเฉิน" variant="outline" onPress={() => navigation.navigate('EmergencyInfo', {petId: p.id})} style={styles.half} />
        <AppButton title="👨‍👩‍👧 Guardian" variant="outline" onPress={() => navigation.navigate('PetGuardians', {petId: p.id})} style={styles.half} />
        <AppButton title="🛡️ Verify" variant="outline" onPress={() => navigation.navigate('OwnershipVerification', {petId: p.id})} style={styles.half} />
      </View>
      {p.status !== 'lost' && (
        <AppButton title="🔴 แจ้งว่าสัตว์ตัวนี้หาย" variant="danger" onPress={() => navigation.navigate('ReportLost', {petId: p.id})} />
      )}
    </Screen>
  );
}

function Info({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {alignItems: 'center', gap: 7, paddingVertical: spacing.md},
  avatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {width: 112, height: 112, borderRadius: 56, backgroundColor: colors.backgroundAlt},
  emoji: {fontSize: 60},
  name: {fontSize: typography.display, fontWeight: '900', color: colors.text},
  code: {fontSize: typography.small, color: colors.primaryDark, fontWeight: '800'},
  galleryTitle: {fontWeight: '900', color: colors.text},
  gallery: {gap: 10, paddingVertical: 4},
  thumbWrap: {position: 'relative'},
  thumb: {width: 96, height: 96, borderRadius: radius.md, backgroundColor: colors.backgroundAlt},
  primaryBadge: {
    position: 'absolute',
    left: 6,
    top: 6,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  primaryText: {color: '#fff', fontSize: 10, fontWeight: '800'},
  thumbActions: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  card: {backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border},
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  label: {color: colors.textSecondary, fontSize: typography.small},
  value: {flex: 1, color: colors.text, fontWeight: '700', textAlign: 'right', fontSize: typography.small},
  emergency: {backgroundColor: '#FFF4DC', borderRadius: radius.lg, padding: spacing.md, gap: 5},
  emergencyTitle: {fontWeight: '900', color: colors.text},
  emergencyText: {color: colors.textSecondary, lineHeight: 20},
  grid: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  half: {width: '48%'},
});
