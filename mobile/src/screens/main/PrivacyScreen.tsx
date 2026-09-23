import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {RootStackParamList} from '../../navigation/types';
import {Screen} from '../../components/Screen';
import {colors, radius, spacing, typography} from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Privacy'>;

export function PrivacyScreen(_props: Props) {
  return (
    <Screen>
      <View style={styles.card}>
        <Text style={styles.title}>ความเป็นส่วนตัว</Text>
        <Text style={styles.body}>
          PetApp ใช้ตำแหน่งเพื่อแสดงประกาศใกล้คุณ และแจ้งเตือนเมื่อมีสัตว์หายในรัศมีที่คุณตั้งค่า
        </Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.itemTitle}>ข้อมูลที่เก็บ</Text>
        <Text style={styles.body}>บัญชีผู้ใช้ · โปรไฟล์สัตว์ · ตำแหน่งประกาศ · ข้อความแชทระหว่างเจ้าของกับผู้พบ</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.itemTitle}>การแชร์ตำแหน่ง</Text>
        <Text style={styles.body}>
          พิกัดที่แนบกับประกาศสัตว์หาย/พบสัตว์จะแสดงต่อชุมชนเพื่อช่วยตามหา ไม่แชร์ตำแหน่งแบบเรียลไทม์ตลอดเวลา
        </Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.itemTitle}>การติดต่อ</Text>
        <Text style={styles.body}>
          การแชทกับเจ้าของสัตว์ทำได้เฉพาะผู้ใช้ที่ล็อกอิน และไม่เปิดเผยอีเมล/เบอร์โทรโดยอัตโนมัติ
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardSolid,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  title: {fontSize: typography.h2, fontWeight: '900', color: colors.text},
  itemTitle: {fontWeight: '900', color: colors.primaryDark},
  body: {color: colors.textSecondary, lineHeight: 21, fontSize: typography.small},
});
