import React, {useState} from 'react';
import {Alert, Pressable, Share, StyleSheet, Text, View} from 'react-native';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {RootStackParamList} from '../../navigation/types';
import {Screen} from '../../components/Screen';
import {AppInput} from '../../components/AppInput';
import {AppButton} from '../../components/AppButton';
import {PhotoPicker} from '../../components/PhotoPicker';
import {createFoundPost} from '../../api/community.api';
import {LocalImage, uploadImage} from '../../api/uploads.api';
import {getCurrentCoordinates} from '../../services/location';
import {getApiErrorMessage} from '../../api/client';
import {PUBLIC_SHARE_BASE} from '../../config/env';
import {colors, radius, spacing, typography} from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ReportFound'>;
type Animal = 'cat' | 'dog' | 'other';

export function ReportFoundScreen({navigation}: Props) {
  const qc = useQueryClient();
  const [animalType, setAnimalType] = useState<Animal>('cat');
  const [breed, setBreed] = useState('');
  const [color, setColor] = useState('');
  const [description, setDescription] = useState('');
  const [locationText, setLocationText] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [images, setImages] = useState<LocalImage[]>([]);
  const [locating, setLocating] = useState(false);

  const mutation = useMutation({
    mutationFn: async (payload: {
      animal_type: Animal;
      breed_guess?: string;
      color?: string;
      description?: string;
      found_at: string;
      latitude: number;
      longitude: number;
      location_text?: string;
      photo?: LocalImage;
    }) => {
      const {photo, ...rest} = payload;
      let image_url: string | undefined;
      if (photo) {
        image_url = await uploadImage(photo);
      }
      return createFoundPost({...rest, image_url});
    },
    onSuccess: post => {
      void qc.invalidateQueries({queryKey: ['found-posts']});
      Alert.alert('ขอบคุณที่ช่วยสัตว์ตัวนี้ 💚', 'โพสต์ถูกสร้างแล้ว สามารถแชร์ต่อให้ชุมชนช่วยตามหาเจ้าของได้', [
        {text: 'ปิด', onPress: () => navigation.goBack()},
        {
          text: 'แชร์',
          onPress: () =>
            void Share.share({
              message: `พบ${post.animal_type === 'cat' ? 'แมว' : post.animal_type === 'dog' ? 'สุนัข' : 'สัตว์'} ${post.location_text || ''}\n${PUBLIC_SHARE_BASE}/found/${post.share_token}`,
            }).finally(() => navigation.goBack()),
        },
      ]);
    },
    onError: e => Alert.alert('โพสต์ไม่สำเร็จ', getApiErrorMessage(e)),
  });

  const locate = async () => {
    setLocating(true);
    try {
      const c = await getCurrentCoordinates();
      setLat(String(c.latitude));
      setLng(String(c.longitude));
    } catch (e) {
      Alert.alert('ตำแหน่ง', e instanceof Error ? e.message : 'ไม่สามารถดึงตำแหน่ง');
    } finally {
      setLocating(false);
    }
  };

  const submit = () => {
    const latitude = Number(lat),
      longitude = Number(lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return Alert.alert('กรุณาระบุตำแหน่งที่พบ');
    }
    mutation.mutate({
      animal_type: animalType,
      breed_guess: breed.trim() || undefined,
      color: color.trim() || undefined,
      description: description.trim() || undefined,
      found_at: new Date().toISOString(),
      latitude,
      longitude,
      location_text: locationText.trim() || undefined,
      photo: images[0],
    });
  };

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.title}>🟢 พบสัตว์หลงทาง</Text>
        <Text style={styles.text}>ไม่จำเป็นต้องรู้ว่าเป็นสัตว์ของใคร แค่ระบุลักษณะและจุดที่พบ</Text>
      </View>
      <Text style={styles.label}>ประเภทสัตว์</Text>
      <View style={styles.chips}>
        {(
          [
            ['cat', '🐱 แมว'],
            ['dog', '🐶 สุนัข'],
            ['other', '🐾 อื่นๆ'],
          ] as const
        ).map(([v, l]) => (
          <Pressable
            key={v}
            onPress={() => setAnimalType(v)}
            style={[styles.chip, animalType === v && styles.active]}>
            <Text style={[styles.chipText, animalType === v && {color: '#fff'}]}>{l}</Text>
          </Pressable>
        ))}
      </View>
      <PhotoPicker images={images} onChange={setImages} max={1} />
      <AppInput label="สายพันธุ์ (ถ้าทราบ)" value={breed} onChangeText={setBreed} />
      <AppInput label="สี / ลาย" value={color} onChangeText={setColor} />
      <AppButton
        title="📍 ใช้ตำแหน่งปัจจุบัน"
        variant="outline"
        loading={locating}
        onPress={() => void locate()}
      />
      <View style={styles.row}>
        <View style={{flex: 1}}>
          <AppInput label="Latitude *" value={lat} onChangeText={setLat} keyboardType="numeric" />
        </View>
        <View style={{flex: 1}}>
          <AppInput label="Longitude *" value={lng} onChangeText={setLng} keyboardType="numeric" />
        </View>
      </View>
      <AppInput label="ชื่อพื้นที่" value={locationText} onChangeText={setLocationText} />
      <AppInput
        label="รายละเอียด"
        value={description}
        onChangeText={setDescription}
        multiline
        style={{minHeight: 110, textAlignVertical: 'top'}}
        placeholder="มีปลอกคอไหม สภาพเป็นอย่างไร พบตรงไหน..."
      />
      <AppButton title="สร้างโพสต์พบสัตว์" onPress={submit} loading={mutation.isPending} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {backgroundColor: colors.primaryLight, borderRadius: radius.lg, padding: spacing.md, gap: 6},
  title: {fontSize: typography.h3, fontWeight: '900', color: colors.primaryDark},
  text: {fontSize: typography.small, color: colors.textSecondary, lineHeight: 20},
  label: {fontSize: typography.small, fontWeight: '800', color: colors.text},
  chips: {flexDirection: 'row', gap: 8},
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  active: {backgroundColor: colors.primary, borderColor: colors.primary},
  chipText: {fontWeight: '800', color: colors.text},
  row: {flexDirection: 'row', gap: spacing.sm},
});
