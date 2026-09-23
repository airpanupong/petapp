import React, {useState} from 'react';
import {Alert, Pressable, StyleSheet, Text, View} from 'react-native';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {RootStackParamList} from '../../navigation/types';
import {Screen} from '../../components/Screen';
import {AppButton} from '../../components/AppButton';
import {LostCard, FoundCard} from '../../components/LostFoundCard';
import {getMyPosts} from '../../api/users.api';
import {cancelLostPost, resolveFoundPost} from '../../api/community.api';
import {getApiErrorMessage} from '../../api/client';
import {colors, spacing, typography} from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'MyPosts'>;

export function MyPostsScreen({navigation}: Props) {
  const qc = useQueryClient();
  const posts = useQuery({queryKey: ['my-posts'], queryFn: getMyPosts});
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = () => void qc.invalidateQueries({queryKey: ['my-posts']});

  const cancelLost = useMutation({
    mutationFn: cancelLostPost,
    onSuccess: () => {
      refresh();
      Alert.alert('ยกเลิกประกาศแล้ว');
    },
    onError: e => Alert.alert('ไม่สำเร็จ', getApiErrorMessage(e)),
    onSettled: () => setBusyId(null),
  });

  const resolveFound = useMutation({
    mutationFn: resolveFoundPost,
    onSuccess: () => {
      refresh();
      Alert.alert('ปิดโพสต์แล้ว');
    },
    onError: e => Alert.alert('ไม่สำเร็จ', getApiErrorMessage(e)),
    onSettled: () => setBusyId(null),
  });

  return (
    <Screen>
      <Text style={styles.section}>ประกาศสัตว์หายของฉัน</Text>
      {posts.data?.lost.map(post => (
        <View key={post.id} style={styles.block}>
          <LostCard post={post} onPress={() => navigation.navigate('LostPostDetail', {postId: post.id})} />
          <View style={styles.actions}>
            <AppButton
              title="ดูรายละเอียด"
              variant="outline"
              style={styles.half}
              onPress={() => navigation.navigate('LostPostDetail', {postId: post.id})}
            />
            {post.status === 'active' && (
              <AppButton
                title="ยกเลิกประกาศ"
                variant="danger"
                style={styles.half}
                loading={busyId === post.id}
                onPress={() =>
                  Alert.alert('ยกเลิกประกาศ?', 'เคสจะถูกปิดและสถานะสัตว์กลับเป็นปกติ', [
                    {text: 'ไม่'},
                    {
                      text: 'ยืนยัน',
                      style: 'destructive',
                      onPress: () => {
                        setBusyId(post.id);
                        cancelLost.mutate(post.id);
                      },
                    },
                  ])
                }
              />
            )}
          </View>
          <Text style={styles.status}>สถานะ: {post.status}</Text>
        </View>
      ))}
      {!posts.isLoading && !posts.data?.lost.length && (
        <Text style={styles.empty}>ยังไม่มีประกาศสัตว์หาย</Text>
      )}

      <Text style={styles.section}>โพสต์พบสัตว์ของฉัน</Text>
      {posts.data?.found.map(post => (
        <View key={post.id} style={styles.block}>
          <FoundCard post={post} onPress={() => navigation.navigate('FoundPostDetail', {postId: post.id})} />
          <View style={styles.actions}>
            <AppButton
              title="ดูรายละเอียด"
              variant="outline"
              style={styles.half}
              onPress={() => navigation.navigate('FoundPostDetail', {postId: post.id})}
            />
            {post.status === 'active' && (
              <AppButton
                title="ปิดโพสต์"
                variant="secondary"
                style={styles.half}
                loading={busyId === post.id}
                onPress={() => {
                  setBusyId(post.id);
                  resolveFound.mutate(post.id);
                }}
              />
            )}
          </View>
          <Text style={styles.status}>สถานะ: {post.status}</Text>
        </View>
      ))}
      {!posts.isLoading && !posts.data?.found.length && (
        <Text style={styles.empty}>ยังไม่มีโพสต์พบสัตว์</Text>
      )}
      <View style={{height: spacing.lg}} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {fontSize: typography.h3, fontWeight: '900', color: colors.text, marginTop: spacing.sm},
  empty: {color: colors.textSecondary, paddingVertical: spacing.sm},
  block: {gap: 8},
  actions: {flexDirection: 'row', gap: 8},
  half: {flex: 1},
  status: {fontSize: typography.caption, color: colors.textSecondary, fontWeight: '700'},
});
