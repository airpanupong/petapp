import React, {useEffect, useState} from 'react';
import {Alert, Pressable, Share, StyleSheet, Text, View} from 'react-native';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {RootStackParamList} from '../../navigation/types';
import {Screen} from '../../components/Screen';
import {AppInput} from '../../components/AppInput';
import {AppButton} from '../../components/AppButton';
import {PhotoPicker} from '../../components/PhotoPicker';
import {listPets} from '../../api/pets.api';
import {createLostPost} from '../../api/community.api';
import {LocalImage, uploadImage} from '../../api/uploads.api';
import {getApiErrorMessage} from '../../api/client';
import {getCurrentCoordinates} from '../../services/location';
import {PUBLIC_SHARE_BASE} from '../../config/env';
import {colors, radius, spacing, typography} from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ReportLost'>;

export function ReportLostScreen({route, navigation}: Props) {
  const queryClient = useQueryClient();
  const pets = useQuery({queryKey: ['pets'], queryFn: listPets});
  const [petId, setPetId] = useState(route.params?.petId || '');
  const [locationText, setLocationText] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [radiusKm, setRadiusKm] = useState(5);
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<LocalImage[]>([]);
  const [gettingLocation, setGettingLocation] = useState(false);

  useEffect(() => {
    if (!petId && pets.data?.length === 1) setPetId(pets.data[0].id);
  }, [petId, pets.data]);

  const mutation = useMutation({
    mutationFn: async (payload: {
      pet_id: string;
      lost_at: string;
      latitude: number;
      longitude: number;
      location_text?: string;
      search_radius_km: number;
      description?: string;
      photo?: LocalImage;
    }) => {
      const {photo, ...rest} = payload;
      let image_url: string | undefined;
      if (photo) {
        image_url = await uploadImage(photo);
      }
      return createLostPost({...rest, image_url});
    },
    onSuccess: post => {
      void queryClient.invalidateQueries({queryKey: ['pets']});
      void queryClient.invalidateQueries({queryKey: ['lost-posts']});
      Alert.alert('ประกาศเรียบร้อย', 'สร้างประกาศสัตว์หายแล้ว ต้องการแชร์ต่อไหม?', [
        {text: 'ปิด', onPress: () => navigation.popToTop()},
        {
          text: 'แชร์',
          onPress: () =>
            void Share.share({
              message: `${post.title}\n${post.location_text || ''}\n${PUBLIC_SHARE_BASE}/lost/${post.share_token}`,
            }).finally(() => navigation.popToTop()),
        },
      ]);
    },
    onError: error => Alert.alert('สร้างประกาศไม่สำเร็จ', getApiErrorMessage(error)),
  });

  const useLocation = async () => {
    setGettingLocation(true);
    try {
      const c = await getCurrentCoordinates();
      setLat(String(c.latitude));
      setLng(String(c.longitude));
    } catch (error) {
      Alert.alert('ดึงตำแหน่งไม่ได้', error instanceof Error ? error.message : 'กรุณากรอกพิกัดเอง');
    } finally {
      setGettingLocation(false);
    }
  };

  const submit = () => {
    const latitude = Number(lat),
      longitude = Number(lng);
    if (!petId) return Alert.alert('เลือกสัตว์ที่หาย');
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return Alert.alert('กรุณาระบุตำแหน่ง');
    mutation.mutate({
      pet_id: petId,
      lost_at: new Date().toISOString(),
      latitude,
      longitude,
      location_text: locationText.trim() || undefined,
      search_radius_km: radiusKm,
      description: description.trim() || undefined,
      photo: images[0],
    });
  };

  return (
    <Screen>
      <View style={styles.alertBox}>
        <Text style={styles.alertTitle}>🔴 แจ้งสัตว์หาย</Text>
        <Text style={styles.alertText}>
          ข้อมูลสัตว์จะถูกดึงจาก Pet Profile อัตโนมัติ คุณเพียงระบุจุดล่าสุดที่เห็น
        </Text>
      </View>
      <Text style={styles.label}>เลือกสัตว์ *</Text>
      <View style={styles.petList}>
        {pets.data?.map(pet => (
          <Pressable
            key={pet.id}
            onPress={() => setPetId(pet.id)}
            style={[styles.petChip, petId === pet.id && styles.petChipActive]}>
            <Text style={styles.petEmoji}>{pet.animal_type === 'dog' ? '🐶' : '🐱'}</Text>
            <Text style={[styles.petName, petId === pet.id && {color: '#fff'}]}>{pet.name}</Text>
          </Pressable>
        ))}
      </View>
      {!pets.isLoading && !pets.data?.length && (
        <AppButton title="เพิ่มสัตว์เลี้ยงก่อน" onPress={() => navigation.navigate('CreatePet')} />
      )}
      <PhotoPicker images={images} onChange={setImages} max={1} />
      <AppButton
        title="📍 ใช้ตำแหน่งปัจจุบัน"
        variant="outline"
        loading={gettingLocation}
        onPress={() => void useLocation()}
      />
      <View style={styles.row}>
        <View style={{flex: 1}}>
          <AppInput label="Latitude *" value={lat} onChangeText={setLat} keyboardType="numeric" />
        </View>
        <View style={{flex: 1}}>
          <AppInput label="Longitude *" value={lng} onChangeText={setLng} keyboardType="numeric" />
        </View>
      </View>
      <AppInput
        label="ชื่อพื้นที่"
        value={locationText}
        onChangeText={setLocationText}
        placeholder="เช่น รัชดา กรุงเทพฯ"
      />
      <Text style={styles.label}>รัศมีแจ้งเตือน</Text>
      <View style={styles.radiusRow}>
        {[1, 3, 5, 10].map(v => (
          <Text
            key={v}
            onPress={() => setRadiusKm(v)}
            style={[styles.radiusChip, radiusKm === v && styles.radiusActive]}>
            {v} km
          </Text>
        ))}
      </View>
      <AppInput
        label="รายละเอียดเพิ่มเติม"
        value={description}
        onChangeText={setDescription}
        multiline
        style={{minHeight: 100, textAlignVertical: 'top'}}
        placeholder="ปลอกคอ เสื้อผ้า ทิศทางที่วิ่งไป..."
      />
      <AppButton
        title="ประกาศสัตว์หาย"
        variant="danger"
        onPress={submit}
        loading={mutation.isPending}
        disabled={!pets.data?.length}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  alertBox: {backgroundColor: '#FDE9E9', borderRadius: radius.lg, padding: spacing.md, gap: 6},
  alertTitle: {fontSize: typography.h3, fontWeight: '900', color: colors.emergency},
  alertText: {color: colors.textSecondary, fontSize: typography.small, lineHeight: 20},
  label: {fontSize: typography.small, fontWeight: '800', color: colors.text},
  petList: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  petChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  petChipActive: {backgroundColor: colors.primary, borderColor: colors.primary},
  petEmoji: {fontSize: 20},
  petName: {fontWeight: '800', color: colors.text},
  row: {flexDirection: 'row', gap: spacing.sm},
  radiusRow: {flexDirection: 'row', gap: 8},
  radiusChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textSecondary,
    fontWeight: '800',
  },
  radiusActive: {backgroundColor: colors.primary, color: '#fff', borderColor: colors.primary},
});
