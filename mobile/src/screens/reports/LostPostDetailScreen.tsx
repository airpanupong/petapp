import React from 'react';
import {Alert, Image, StyleSheet, Text, View} from 'react-native';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {RootStackParamList} from '../../navigation/types';
import {getLostPost, listSightings, resolveLostPost} from '../../api/community.api';
import {followLostCase, getFollowStatus, unfollowLostCase} from '../../api/features.api';
import {contactLostOwner} from '../../api/chat.api';
import {resolveMediaUrl} from '../../api/uploads.api';
import {getApiErrorMessage} from '../../api/client';
import {Screen} from '../../components/Screen';
import {AppButton} from '../../components/AppButton';
import {StatusBadge} from '../../components/StatusBadge';
import {ShareActions} from '../../components/ShareActions';
import {ReportModal} from '../../components/ReportModal';
import {PUBLIC_SHARE_BASE} from '../../config/env';
import {useAuthStore} from '../../store/authStore';
import {createLostShareCard} from '../../api/community.api';
import {colors, radius, spacing, typography} from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'LostPostDetail'>;

export function LostPostDetailScreen({route, navigation}: Props) {
  const id = route.params.postId;
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);
  const [reportOpen, setReportOpen] = React.useState(false);
  const post = useQuery({queryKey: ['lost-post', id], queryFn: () => getLostPost(id)});
  const sightings = useQuery({queryKey: ['sightings', id], queryFn: () => listSightings(id)});
  const follow = useQuery({queryKey: ['follow', id], queryFn: () => getFollowStatus(id)});
  const toggle = useMutation({
    mutationFn: async () => {
      if (follow.data) await unfollowLostCase(id);
      else await followLostCase(id);
    },
    onSuccess: () => void qc.invalidateQueries({queryKey: ['follow', id]}),
  });
  const resolve = useMutation({
    mutationFn: () => resolveLostPost(id),
    onSuccess: () => {
      void qc.invalidateQueries({queryKey: ['lost-posts']});
      void qc.invalidateQueries({queryKey: ['lost-post', id]});
      Alert.alert('ดีใจด้วย 🎉', 'เคสนี้ถูกปิดและสัตว์ถูกตั้งสถานะว่ากลับบ้านแล้ว');
    },
  });

  if (!post.data) {
    return (
      <Screen>
        <Text style={{color: colors.textSecondary}}>กำลังโหลด...</Text>
      </Screen>
    );
  }

  const p = post.data;
  const owner = p.owner_id === user?.id;
  const imageUri = resolveMediaUrl(p.image_url) || resolveMediaUrl(p.pet?.profile_image_url);

  return (
    <Screen>
      {imageUri ? <Image source={{uri: imageUri}} style={styles.cover} /> : null}
      <View style={styles.hero}>
        <Text style={styles.pet}>{p.pet?.animal_type === 'dog' ? '🐶' : '🐱'}</Text>
        <View style={{flex: 1}}>
          <Text style={styles.title}>{p.pet?.name || p.title}</Text>
          <Text style={styles.meta}>
            {p.pet?.breed || p.pet?.animal_type} · {p.pet?.color || 'ไม่ระบุสี'}
          </Text>
        </View>
        <StatusBadge status={p.status} />
      </View>
      <View style={styles.alert}>
        <Text style={styles.alertTitle}>📍 จุดที่หาย</Text>
        <Text style={styles.body}>{p.location_text || `${p.latitude}, ${p.longitude}`}</Text>
        <Text style={styles.meta}>
          หายเมื่อ {new Date(p.lost_at).toLocaleString()} · รัศมีค้นหา {p.search_radius_km} กม.
        </Text>
        {!!p.description && <Text style={styles.body}>{p.description}</Text>}
      </View>
      <View style={styles.actions}>
        <AppButton
          title="👀 แจ้งเบาะแส"
          onPress={() => navigation.navigate('Sighting', {lostPostId: id})}
          style={{flex: 1}}
        />
        <AppButton
          title={follow.data ? '🔔 กำลังติดตาม' : '🔔 ช่วยติดตาม'}
          variant="outline"
          onPress={() => toggle.mutate()}
          style={{flex: 1}}
        />
      </View>
      {!owner && (
        <AppButton
          title="💬 ติดต่อเจ้าของ"
          variant="secondary"
          onPress={() => {
            void contactLostOwner(id)
              .then(c => navigation.navigate('ChatThread', {conversationId: c.id}))
              .catch(e => Alert.alert('เปิดแชทไม่สำเร็จ', getApiErrorMessage(e)));
          }}
        />
      )}
      <ShareActions
        title={`ตามหา ${p.pet?.name || 'สัตว์เลี้ยง'}`}
        message={`LOST PET · ${p.pet?.name || p.title}\n${p.pet?.breed || p.pet?.animal_type || ''} ${p.pet?.color || ''}\nLast seen: ${p.location_text || ''}\n${new Date(p.lost_at).toLocaleDateString()}`}
        url={`${PUBLIC_SHARE_BASE}/lost/${p.share_token}`}
        onRequestShareCard={async () => (await createLostShareCard(id)).url}
      />
      {!owner && (
        <AppButton title="🚩 รายงานประกาศนี้" variant="outline" onPress={() => setReportOpen(true)} />
      )}
      <ReportModal
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="lost_post"
        targetId={id}
        blockUserId={owner ? undefined : p.owner_id}
      />
      {owner && p.status === 'active' && (
        <AppButton
          title="✅ พบแล้ว / ปิดเคส"
          variant="outline"
          onPress={() =>
            Alert.alert('ปิดเคส', 'ยืนยันว่าพบสัตว์แล้ว?', [
              {text: 'ยกเลิก'},
              {text: 'ยืนยัน', onPress: () => resolve.mutate()},
            ])
          }
        />
      )}
      <Text style={styles.section}>Timeline เบาะแส ({sightings.data?.length || 0})</Text>
      {sightings.data?.map(s => (
        <View key={s.id} style={styles.sighting}>
          <Text style={styles.sightTitle}>👀 {s.location_text || 'จุดที่พบเห็น'}</Text>
          <Text style={styles.meta}>
            {new Date(s.seen_at).toLocaleString()}
            {s.direction ? ` · ${s.direction}` : ''}
          </Text>
          {!!s.description && <Text style={styles.body}>{s.description}</Text>}
        </View>
      ))}
      {!sightings.data?.length && (
        <Text style={styles.meta}>ยังไม่มีเบาะแส — คุณสามารถเป็นคนแรกที่ช่วยแจ้งได้</Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cover: {width: '100%', height: 220, borderRadius: radius.xl, backgroundColor: colors.backgroundAlt},
  hero: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pet: {fontSize: 48},
  title: {fontSize: typography.h2, fontWeight: '900', color: colors.text},
  meta: {fontSize: typography.small, color: colors.textSecondary, lineHeight: 20},
  alert: {backgroundColor: '#FDE9E9', borderRadius: radius.lg, padding: spacing.md, gap: 6},
  alertTitle: {fontSize: typography.h3, fontWeight: '900', color: colors.emergency},
  body: {color: colors.text, lineHeight: 21},
  actions: {flexDirection: 'row', gap: 8},
  section: {fontSize: typography.h2, fontWeight: '900', color: colors.text, marginTop: 6},
  sighting: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  sightTitle: {fontWeight: '900', color: colors.text},
});
