import React from 'react';
import {FlatList, Pressable, StyleSheet, Text, View} from 'react-native';
import {useQuery} from '@tanstack/react-query';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {RootStackParamList} from '../../navigation/types';
import {Screen} from '../../components/Screen';
import {AppIcon} from '../../components/AppIcon';
import {listConversations} from '../../api/chat.api';
import {colors, radius, shadow, spacing, typography} from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatList'>;

export function ChatListScreen({navigation}: Props) {
  const chats = useQuery({queryKey: ['conversations'], queryFn: listConversations});

  return (
    <Screen scroll={false}>
      <FlatList
        data={chats.data || []}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {chats.isLoading ? 'กำลังโหลด...' : 'ยังไม่มีแชท — กดติดต่อเจ้าของจากประกาศหรือ QR ได้'}
          </Text>
        }
        renderItem={({item}) => (
          <Pressable
            style={styles.row}
            onPress={() => navigation.navigate('ChatThread', {conversationId: item.id})}>
            <View style={styles.avatar}>
              <AppIcon name="chatbubble-ellipses" size={22} color={colors.primaryDark} />
            </View>
            <View style={{flex: 1}}>
              <Text style={styles.name}>{item.other_member?.display_name || 'แชท'}</Text>
              <Text style={styles.preview} numberOfLines={1}>
                {item.last_message?.content || 'เริ่มสนทนาได้เลย'}
              </Text>
            </View>
            <AppIcon name="chevron-forward" size={18} color={colors.textSecondary} />
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {padding: spacing.md, gap: 10, flexGrow: 1},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.cardSolid,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.soft,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {fontWeight: '900', color: colors.text},
  preview: {color: colors.textSecondary, marginTop: 3, fontSize: typography.small},
  empty: {textAlign: 'center', color: colors.textSecondary, marginTop: spacing.xl, lineHeight: 22},
});
