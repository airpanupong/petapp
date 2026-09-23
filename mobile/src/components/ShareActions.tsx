import React, {useState} from 'react';
import {Alert, Pressable, Share, StyleSheet, Text, View} from 'react-native';

import {AppIcon} from './AppIcon';
import {colors, radius, typography} from '../theme';

type Props = {
  title: string;
  message: string;
  url: string;
  /** Optional: fetch a generated share-card image URL */
  onRequestShareCard?: () => Promise<string | undefined>;
};

export function ShareActions({title, message, url, onRequestShareCard}: Props) {
  const [loading, setLoading] = useState(false);
  const full = `${message}\n${url}`.trim();

  const shareNative = async () => {
    try {
      setLoading(true);
      let cardUrl: string | undefined;
      if (onRequestShareCard) {
        try {
          cardUrl = await onRequestShareCard();
        } catch {
          // fall back to text share
        }
      }
      await Share.share({
        title,
        message: cardUrl ? `${full}\n\nShare card: ${cardUrl}` : full,
      });
    } catch {
      // cancelled
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    try {
      await Share.share({title: 'คัดลอกลิงก์', message: url});
    } catch {
      Alert.alert('ลิงก์ประกาศ', url);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>แชร์ประกาศ</Text>
      <View style={styles.row}>
        <Pressable style={styles.btn} onPress={() => void shareNative()} disabled={loading}>
          <AppIcon name="share-outline" size={18} color={colors.primaryDark} />
          <Text style={styles.btnText}>{loading ? 'กำลังสร้างการ์ด...' : 'แชร์'}</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={() => void copyLink()}>
          <AppIcon name="link-outline" size={18} color={colors.primaryDark} />
          <Text style={styles.btnText}>คัดลอกลิงก์</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>แชร์ผ่าน Share Sheet (LINE / Facebook / Instagram / X) · มี Share Card รูปเมื่อสร้างได้</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {gap: 8},
  label: {fontWeight: '800', color: colors.text, fontSize: typography.small},
  row: {flexDirection: 'row', gap: 8},
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnText: {fontWeight: '800', color: colors.primaryDark, fontSize: typography.small},
  hint: {fontSize: typography.caption, color: colors.textSecondary, lineHeight: 18},
});
