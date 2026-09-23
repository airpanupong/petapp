import React from 'react';
import {Share, StyleSheet, Text, View} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import {useQuery} from '@tanstack/react-query';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {RootStackParamList} from '../../navigation/types';
import {getPet} from '../../api/pets.api';
import {PUBLIC_PET_WEB_BASE} from '../../config/env';
import {Screen} from '../../components/Screen';
import {AppButton} from '../../components/AppButton';
import {colors, radius, spacing, typography} from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'PetQR'>;

export function PetQRScreen({route}: Props) {
  const pet = useQuery({queryKey: ['pet', route.params.petId], queryFn: () => getPet(route.params.petId)});
  if (!pet.data) return <Screen><Text>กำลังโหลด...</Text></Screen>;
  const url = `${PUBLIC_PET_WEB_BASE}/${pet.data.qr_token}`;
  return (
    <Screen contentStyle={styles.content}>
      <Text style={styles.title}>{pet.data.name}</Text>
      <Text style={styles.sub}>ให้ผู้พบสัตว์สแกน QR นี้เพื่อดู Public Pet Profile โดยไม่เปิดเผยข้อมูลส่วนตัวเจ้าของ</Text>
      <View style={styles.qrCard}>
        <QRCode value={url} size={230} backgroundColor="#FFFFFF" color={colors.text} />
        <Text style={styles.code}>{pet.data.pet_code}</Text>
      </View>
      <View style={styles.notice}><Text style={styles.noticeTitle}>🔐 Privacy First</Text><Text style={styles.noticeText}>QR เก็บเฉพาะ secure token ไม่ฝังเบอร์โทร อีเมล หรือที่อยู่ของคุณ</Text></View>
      <AppButton title="แชร์ Pet ID" onPress={() => void Share.share({message: `${pet.data.name} · Pet ID ${pet.data.pet_code}\n${url}`})} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {alignItems: 'center'},
  title: {fontSize: typography.h1, fontWeight: '900', color: colors.text},
  sub: {fontSize: typography.small, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, maxWidth: 330},
  qrCard: {backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.xl, alignItems: 'center', gap: spacing.md, borderWidth: 1, borderColor: colors.border},
  code: {fontSize: typography.h3, fontWeight: '900', color: colors.primaryDark, letterSpacing: 1.2},
  notice: {alignSelf: 'stretch', backgroundColor: colors.primaryLight, borderRadius: radius.lg, padding: spacing.md, gap: 5},
  noticeTitle: {fontWeight: '900', color: colors.primaryDark},
  noticeText: {fontSize: typography.small, color: colors.textSecondary, lineHeight: 20},
});
