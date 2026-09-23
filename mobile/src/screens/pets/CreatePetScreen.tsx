import React, {useState} from 'react';
import {Alert, Pressable, StyleSheet, Text, View} from 'react-native';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {RootStackParamList} from '../../navigation/types';
import {Screen} from '../../components/Screen';
import {AppInput} from '../../components/AppInput';
import {AppButton} from '../../components/AppButton';
import {createPet} from '../../api/pets.api';
import {getApiErrorMessage} from '../../api/client';
import {colors, radius, spacing, typography} from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'CreatePet'>;
type AnimalType = 'dog' | 'cat' | 'other';

export function CreatePetScreen({navigation}: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [animalType, setAnimalType] = useState<AnimalType>('cat');
  const [breed, setBreed] = useState('');
  const [color, setColor] = useState('');
  const [gender, setGender] = useState('');
  const [marks, setMarks] = useState('');
  const [emergency, setEmergency] = useState('');

  const mutation = useMutation({
    mutationFn: createPet,
    onSuccess: pet => {
      void queryClient.invalidateQueries({queryKey: ['pets']});
      navigation.replace('PetDetail', {petId: pet.id});
    },
    onError: error => Alert.alert('เพิ่มสัตว์ไม่สำเร็จ', getApiErrorMessage(error)),
  });

  const submit = () => {
    if (!name.trim()) {
      Alert.alert('กรุณาใส่ชื่อสัตว์เลี้ยง');
      return;
    }
    mutation.mutate({
      name: name.trim(), animal_type: animalType, breed: breed.trim() || undefined,
      color: color.trim() || undefined, gender: gender.trim() || undefined,
      distinctive_marks: marks.trim() || undefined,
      emergency_note: emergency.trim() || undefined,
    });
  };

  return (
    <Screen>
      <View style={styles.infoBox}><Text style={styles.infoTitle}>🐾 สร้าง Digital Pet ID</Text><Text style={styles.infoText}>หลังบันทึก ระบบจะสร้าง Pet ID และ QR token ที่ไม่เปิดเผยเบอร์โทรหรือที่อยู่เจ้าของ</Text></View>
      <Text style={styles.label}>ประเภทสัตว์</Text>
      <View style={styles.chips}>
        {([['cat','🐱 แมว'],['dog','🐶 สุนัข'],['other','🐾 อื่นๆ']] as const).map(([value,label]) => (
          <Pressable key={value} onPress={() => setAnimalType(value)} style={[styles.chip, animalType === value && styles.chipActive]}><Text style={[styles.chipText, animalType === value && styles.chipTextActive]}>{label}</Text></Pressable>
        ))}
      </View>
      <AppInput label="ชื่อสัตว์ *" value={name} onChangeText={setName} placeholder="เช่น Momo" />
      <AppInput label="สายพันธุ์" value={breed} onChangeText={setBreed} placeholder="เช่น Domestic Shorthair" />
      <AppInput label="สี / ลาย" value={color} onChangeText={setColor} placeholder="เช่น ขาว-ส้ม" />
      <AppInput label="เพศ" value={gender} onChangeText={setGender} placeholder="เช่น female / male" />
      <AppInput label="ตำหนิ / ลักษณะเฉพาะ" value={marks} onChangeText={setMarks} multiline style={{minHeight: 90, textAlignVertical: 'top'}} />
      <AppInput label="ข้อมูลฉุกเฉินที่อนุญาตให้คนสแกนเห็น" value={emergency} onChangeText={setEmergency} multiline placeholder="เช่น ห้ามให้อาหารที่มีไก่" style={{minHeight: 90, textAlignVertical: 'top'}} />
      <AppButton title="สร้าง Pet ID" onPress={submit} loading={mutation.isPending} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  infoBox: {backgroundColor: colors.primaryLight, padding: spacing.md, borderRadius: radius.lg, gap: 5},
  infoTitle: {fontSize: typography.h3, fontWeight: '900', color: colors.primaryDark},
  infoText: {fontSize: typography.small, color: colors.textSecondary, lineHeight: 20},
  label: {fontSize: typography.small, fontWeight: '800', color: colors.text},
  chips: {flexDirection: 'row', gap: 8},
  chip: {paddingHorizontal: 15, paddingVertical: 10, borderRadius: radius.xl, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border},
  chipActive: {backgroundColor: colors.primary, borderColor: colors.primary},
  chipText: {fontWeight: '700', color: colors.textSecondary},
  chipTextActive: {color: '#fff'},
});
