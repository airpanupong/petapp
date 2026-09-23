import React from 'react';
import {Alert, Image, StyleSheet, Text, View} from 'react-native';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {RootStackParamList} from '../../navigation/types';
import {getFoundPost} from '../../api/community.api';
import {api, getApiErrorMessage} from '../../api/client';
import {contactFoundReporter} from '../../api/chat.api';
import {resolveMediaUrl} from '../../api/uploads.api';
import {Screen} from '../../components/Screen';
import {AppButton} from '../../components/AppButton';
import {ShareActions} from '../../components/ShareActions';
import {ReportModal} from '../../components/ReportModal';
import {PUBLIC_SHARE_BASE} from '../../config/env';
import {useAuthStore} from '../../store/authStore';
import {createFoundShareCard} from '../../api/community.api';
import {colors, radius, spacing, typography} from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'FoundPostDetail'>;

export function FoundPostDetailScreen({route, navigation}: Props) {
  const id = route.params.postId;
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);
  const [reportOpen, setReportOpen] = React.useState(false);
  const q = useQuery({queryKey: ['found-post', id], queryFn: () => getFoundPost(id)});
  const resolve = useMutation({
    mutationFn: () => api.post(`/found-posts/${id}/resolve`),
    onSuccess: () => {
      void qc.invalidateQueries({queryKey: ['found-posts']});
      void qc.invalidateQueries({queryKey: ['found-post', id]});
      Alert.alert('ปิดประกาศแล้ว');
    },
  });

  if (!q.data) {
    return (
      <Screen>
        <Text>กำลังโหลด...</Text>
      </Screen>
    );
  }

  const p = q.data;
  const imageUri = resolveMediaUrl(p.image_url);
  const animal =
    p.animal_type === 'dog' ? 'สุนัข' : p.animal_type === 'cat' ? 'แมว' : 'สัตว์';
  const isReporter = p.reporter_id === user?.id;

  return (
    <Screen>
      {imageUri ? (
        <Image source={{uri: imageUri}} style={styles.cover} />
      ) : (
        <View style={styles.hero}>
          <Text style={styles.emoji}>
            {p.animal_type === 'dog' ? '🐶' : p.animal_type === 'cat' ? '🐱' : '🐾'}
          </Text>
        </View>
      )}
      <Text style={styles.title}>พบ{animal}</Text>
      <Text style={styles.status}>{p.status}</Text>
      <View style={styles.card}>
        <Info l="ลักษณะ" v={[p.breed_guess, p.color].filter(Boolean).join(' · ') || 'ไม่ระบุ'} />
        <Info l="สถานที่" v={p.location_text || `${p.latitude}, ${p.longitude}`} />
        <Info l="เวลาที่พบ" v={new Date(p.found_at).toLocaleString()} />
        {!!p.description && <Text style={styles.desc}>{p.description}</Text>}
      </View>
      {!isReporter && p.reporter_id && (
        <AppButton
          title="💬 ติดต่อผู้พบ"
          variant="secondary"
          onPress={() => {
            void contactFoundReporter(id)
              .then(c => navigation.navigate('ChatThread', {conversationId: c.id}))
              .catch(e => Alert.alert('เปิดแชทไม่สำเร็จ', getApiErrorMessage(e)));
          }}
        />
      )}
      <ShareActions
        title={`พบ${animal}`}
        message={`FOUND PET · ${animal}\n${[p.breed_guess, p.color].filter(Boolean).join(' · ')}\nFound at: ${p.location_text || ''}\n${new Date(p.found_at).toLocaleDateString()}`}
        url={`${PUBLIC_SHARE_BASE}/found/${p.share_token}`}
        onRequestShareCard={async () => (await createFoundShareCard(id)).url}
      />
      {!isReporter && (
        <AppButton title="🚩 รายงานโพสต์นี้" variant="outline" onPress={() => setReportOpen(true)} />
      )}
      <ReportModal
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="found_post"
        targetId={id}
        blockUserId={p.reporter_id || undefined}
      />
      {isReporter && p.status === 'active' && (
        <AppButton title="พบเจ้าของแล้ว / ปิดโพสต์" variant="outline" onPress={() => resolve.mutate()} />
      )}
      <View style={styles.tip}>
        <Text style={styles.tipTitle}>🔐 การยืนยันเจ้าของ</Text>
        <Text style={styles.desc}>
          ก่อนส่งมอบสัตว์ ให้ขอหลักฐาน เช่น รูปเก่า ตำหนิเฉพาะ หรือ Microchip และหลีกเลี่ยงการเปิดเผยข้อมูลลับในโพสต์สาธารณะ
        </Text>
      </View>
    </Screen>
  );
}

function Info({l, v}: {l: string; v: string}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{l}</Text>
      <Text style={styles.value}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {width: '100%', height: 220, borderRadius: radius.xl, backgroundColor: colors.backgroundAlt},
  hero: {alignItems: 'center', gap: 6},
  emoji: {fontSize: 70},
  title: {fontSize: typography.h1, fontWeight: '900', color: colors.text, textAlign: 'center'},
  status: {fontWeight: '800', color: colors.primaryDark, textAlign: 'center'},
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  label: {color: colors.textSecondary},
  value: {flex: 1, textAlign: 'right', fontWeight: '800', color: colors.text},
  desc: {color: colors.textSecondary, lineHeight: 21, marginTop: 8},
  tip: {backgroundColor: colors.primaryLight, borderRadius: radius.lg, padding: spacing.md},
  tipTitle: {fontWeight: '900', fontSize: typography.h3, color: colors.primaryDark},
});
