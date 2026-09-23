import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {RootStackParamList} from '../../navigation/types';
import {listNotifications, markAllNotificationsRead, markNotificationRead} from '../../api/features.api';
import {Screen} from '../../components/Screen';
import {AppButton} from '../../components/AppButton';
import {EmptyState} from '../../components/EmptyState';
import {AppIcon} from '../../components/AppIcon';
import {useI18n} from '../../i18n/useI18n';
import {colors, radius, shadow, spacing, typography} from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

export function NotificationsScreen({navigation}: Props) {
  const qc = useQueryClient();
  const t = useI18n(s => s.t);
  const q = useQuery({queryKey: ['notifications'], queryFn: listNotifications});

  const open = async (id: string, refType?: string | null, refId?: string | null) => {
    await markNotificationRead(id);
    void qc.invalidateQueries({queryKey: ['notifications']});
    if (refType === 'lost_post' && refId) {
      navigation.navigate('LostPostDetail', {postId: refId});
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>{t('screen_notifications')}</Text>
        <Text style={styles.desc}>{t('menuNotificationsDesc')}</Text>
      </View>
      <AppButton
        title={t('markAllRead')}
        variant="outline"
        icon="checkmark-done-outline"
        onPress={() => void markAllNotificationsRead().then(() => qc.invalidateQueries({queryKey: ['notifications']}))}
      />
      {q.data?.map(n => (
        <Pressable
          key={n.id}
          onPress={() => void open(n.id, n.reference_type, n.reference_id)}
          style={[styles.card, !n.is_read && styles.unread]}>
          <View style={styles.dot}>
            {!n.is_read && <View style={styles.unreadDot} />}
          </View>
          <View style={{flex: 1}}>
            <Text style={styles.cardTitle}>{n.title}</Text>
            <Text style={styles.body}>{n.body}</Text>
            <Text style={styles.time}>{new Date(n.created_at).toLocaleString()}</Text>
          </View>
          <AppIcon name="chevron-forward" size={16} color={colors.textSecondary} />
        </Pressable>
      ))}
      {!q.isLoading && !q.data?.length && (
        <EmptyState icon="notifications-off-outline" title={t('noNotifications')} description={t('noNotificationsDesc')} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {gap: 5},
  title: {fontSize: typography.h1, fontWeight: '900', color: colors.text, letterSpacing: -0.4},
  desc: {color: colors.textSecondary, lineHeight: 20},
  card: {
    backgroundColor: colors.cardSolid,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.soft,
  },
  unread: {backgroundColor: colors.primaryMuted, borderColor: '#BDE6DF'},
  dot: {width: 14, alignItems: 'center'},
  unreadDot: {width: 8, height: 8, borderRadius: 4, backgroundColor: colors.emergency},
  cardTitle: {fontWeight: '900', color: colors.text},
  body: {color: colors.textSecondary, lineHeight: 20, marginTop: 4},
  time: {color: colors.textSecondary, fontSize: typography.caption, marginTop: 6},
});
