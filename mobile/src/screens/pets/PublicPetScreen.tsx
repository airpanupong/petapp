import React, {useState} from 'react';
import {Alert, StyleSheet, Text, View} from 'react-native';
import {useQuery} from '@tanstack/react-query';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {RootStackParamList} from '../../navigation/types';
import {getPublicPetByQr} from '../../api/pets.api';
import {reportRegisteredPetFound} from '../../api/features.api';
import {contactPetOwner} from '../../api/chat.api';
import {getCurrentCoordinates} from '../../services/location';
import {getApiErrorMessage} from '../../api/client';
import {Screen} from '../../components/Screen';
import {AppButton} from '../../components/AppButton';
import {colors, radius, spacing, typography} from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'PublicPet'>;

export function PublicPetScreen({route, navigation}: Props) {
  const q = useQuery({
    queryKey: ['public-pet', route.params.qrToken],
    queryFn: () => getPublicPetByQr(route.params.qrToken),
  });
  const [sending, setSending] = useState(false);
  const [chatting, setChatting] = useState(false);

  if (!q.data) {
    return (
      <Screen>
        <Text>กำลังตรวจสอบ Pet ID...</Text>
      </Screen>
    );
  }

  const p = q.data;
  const e = p.emergency;

  const found = async () => {
    setSending(true);
    try {
      const c = await getCurrentCoordinates();
      await reportRegisteredPetFound(route.params.qrToken, {...c});
      Alert.alert('แจ้งเจ้าของแล้ว 💚', `เราได้ส่งตำแหน่งที่พบ ${p.name} ไปยังเจ้าของแล้ว`);
    } catch (err) {
      Alert.alert('แจ้งไม่สำเร็จ', getApiErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const contact = async () => {
    setChatting(true);
    try {
      const conversation = await contactPetOwner(route.params.qrToken);
      navigation.navigate('ChatThread', {conversationId: conversation.id});
    } catch (err) {
      Alert.alert('เปิดแชทไม่สำเร็จ', getApiErrorMessage(err));
    } finally {
      setChatting(false);
    }
  };

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.emoji}>{p.animal_type === 'dog' ? '🐶' : '🐱'}</Text>
        <Text style={styles.title}>
          {p.name} {p.ownership_verified ? '✅' : ''}
        </Text>
        <Text style={styles.code}>{p.pet_code}</Text>
        <Text style={styles.meta}>
          {p.breed || p.animal_type} · {p.color || 'ไม่ระบุสี'} · {p.status}
        </Text>
      </View>
      {(e?.emergency_note || e?.public_allergies || e?.public_medications || e?.public_conditions) && (
        <View style={styles.emergency}>
          <Text style={styles.emergencyTitle}>⚠️ ข้อมูลฉุกเฉิน</Text>
          {!!e?.emergency_note && <Text style={styles.body}>{e.emergency_note}</Text>}
          {!!e?.public_allergies && <Text style={styles.body}>แพ้: {e.public_allergies}</Text>}
          {!!e?.public_medications && <Text style={styles.body}>ยา: {e.public_medications}</Text>}
          {!!e?.public_conditions && <Text style={styles.body}>ภาวะสุขภาพ: {e.public_conditions}</Text>}
          {!!e?.emergency_contact_phone && (
            <Text style={styles.body}>
              ติดต่อฉุกเฉิน: {e.emergency_contact_name || ''} {e.emergency_contact_phone}
            </Text>
          )}
        </View>
      )}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>ลักษณะเฉพาะ</Text>
        <Text style={styles.body}>{p.distinctive_marks || p.description || 'ไม่มีข้อมูลเพิ่มเติม'}</Text>
      </View>
      <AppButton title="🟢 ฉันพบสัตว์ตัวนี้ — แจ้งเจ้าของ" onPress={() => void found()} loading={sending} />
      {p.actions?.contact_owner !== false && (
        <AppButton title="💬 แชทกับเจ้าของ" variant="secondary" onPress={() => void contact()} loading={chatting} />
      )}
      <AppButton title="สร้างโพสต์พบสัตว์สาธารณะ" variant="outline" onPress={() => navigation.navigate('ReportFound')} />
      <AppButton title="สแกนตัวอื่น" variant="outline" onPress={() => navigation.replace('QRScanner')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {alignItems: 'center', gap: 5},
  emoji: {fontSize: 72},
  title: {fontSize: typography.h1, fontWeight: '900', color: colors.text},
  code: {fontWeight: '900', color: colors.primaryDark},
  meta: {color: colors.textSecondary},
  emergency: {backgroundColor: '#FFF4DC', borderRadius: radius.lg, padding: spacing.md, gap: 5},
  emergencyTitle: {fontSize: typography.h3, fontWeight: '900', color: colors.text},
  body: {color: colors.textSecondary, lineHeight: 21},
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {fontWeight: '900', color: colors.text, marginBottom: 5},
});
