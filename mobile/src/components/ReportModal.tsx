import React, {useState} from 'react';
import {Alert, Modal, Pressable, StyleSheet, Text, View} from 'react-native';

import {AppButton} from './AppButton';
import {AppInput} from './AppInput';
import {createReport, blockUser} from '../api/moderation.api';
import {getApiErrorMessage} from '../api/client';
import {colors, radius, spacing, typography} from '../theme';

const REASONS = [
  {id: 'spam', label: 'สแปม'},
  {id: 'fake_post', label: 'โพสต์ปลอม'},
  {id: 'fraud', label: 'หลอกลวง'},
  {id: 'inappropriate', label: 'เนื้อหาไม่เหมาะสม'},
  {id: 'animal_abuse', label: 'สงสัยทารุณสัตว์'},
  {id: 'harassment', label: 'คุกคาม'},
  {id: 'other', label: 'อื่นๆ'},
] as const;

type Props = {
  visible: boolean;
  onClose: () => void;
  targetType: 'lost_post' | 'found_post' | 'user';
  targetId: string;
  blockUserId?: string;
  title?: string;
};

export function ReportModal({visible, onClose, targetType, targetId, blockUserId, title}: Props) {
  const [reason, setReason] = useState<(typeof REASONS)[number]['id']>('spam');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      await createReport({
        target_type: targetType,
        target_id: targetId,
        reason,
        details: details.trim() || undefined,
      });
      Alert.alert('ส่งรายงานแล้ว', 'ทีมงานจะตรวจสอบโดยเร็ว');
      onClose();
    } catch (e) {
      Alert.alert('รายงานไม่สำเร็จ', getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const doBlock = async () => {
    if (!blockUserId) return;
    setLoading(true);
    try {
      await blockUser(blockUserId);
      Alert.alert('บล็อกแล้ว', 'คุณจะไม่สามารถแชทกับผู้ใช้นี้ได้');
      onClose();
    } catch (e) {
      Alert.alert('บล็อกไม่สำเร็จ', getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{title || 'รายงานเนื้อหา'}</Text>
          <View style={styles.reasons}>
            {REASONS.map(r => (
              <Pressable
                key={r.id}
                onPress={() => setReason(r.id)}
                style={[styles.chip, reason === r.id && styles.chipActive]}>
                <Text style={[styles.chipText, reason === r.id && styles.chipTextActive]}>{r.label}</Text>
              </Pressable>
            ))}
          </View>
          <AppInput
            label="รายละเอียดเพิ่มเติม"
            value={details}
            onChangeText={setDetails}
            multiline
            style={{minHeight: 80, textAlignVertical: 'top'}}
          />
          <AppButton title="ส่งรายงาน" onPress={() => void submit()} loading={loading} />
          {!!blockUserId && (
            <AppButton title="บล็อกผู้ใช้นี้" variant="danger" onPress={() => void doBlock()} loading={loading} />
          )}
          <AppButton title="ยกเลิก" variant="outline" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end'},
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: {fontSize: typography.h2, fontWeight: '900', color: colors.text},
  reasons: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.cardSolid,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {backgroundColor: colors.primary, borderColor: colors.primary},
  chipText: {fontWeight: '700', color: colors.textSecondary, fontSize: 12},
  chipTextActive: {color: '#fff'},
});
