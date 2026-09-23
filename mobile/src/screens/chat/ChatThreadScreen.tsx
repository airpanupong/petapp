import React, {useEffect, useRef, useState} from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
} from 'react-native';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {RootStackParamList} from '../../navigation/types';
import {getConversation, listMessages, sendMessage, ChatMessage} from '../../api/chat.api';
import {useAuthStore} from '../../store/authStore';
import {colors, radius, spacing, typography} from '../../theme';
import {AppIcon} from '../../components/AppIcon';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatThread'>;

export function ChatThreadScreen({route}: Props) {
  const id = route.params.conversationId;
  const user = useAuthStore(s => s.user);
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const conversation = useQuery({queryKey: ['conversation', id], queryFn: () => getConversation(id)});
  const messages = useQuery({
    queryKey: ['messages', id],
    queryFn: () => listMessages(id),
    refetchInterval: 4000,
  });

  const send = useMutation({
    mutationFn: (content: string) => sendMessage(id, {content}),
    onSuccess: () => {
      setText('');
      void qc.invalidateQueries({queryKey: ['messages', id]});
      void qc.invalidateQueries({queryKey: ['conversations']});
    },
  });

  useEffect(() => {
    if (messages.data?.length) {
      setTimeout(() => listRef.current?.scrollToEnd({animated: true}), 100);
    }
  }, [messages.data?.length]);

  const submit = () => {
    const content = text.trim();
    if (!content || send.isPending) return;
    send.mutate(content);
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={88}>
      <View style={styles.header}>
        <Text style={styles.title}>{conversation.data?.other_member?.display_name || 'แชท'}</Text>
      </View>
      <FlatList
        ref={listRef}
        data={messages.data || []}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({item}) => {
          const mine = item.sender_id === user?.id;
          return (
            <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
              <Text style={[styles.msg, mine && styles.msgMine]}>{item.content}</Text>
              <Text style={[styles.time, mine && styles.timeMine]}>
                {new Date(item.created_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
              </Text>
            </View>
          );
        }}
      />
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="พิมพ์ข้อความ..."
          placeholderTextColor={colors.textSecondary}
          multiline
        />
        <Pressable style={styles.send} onPress={submit} disabled={send.isPending}>
          <AppIcon name="send" size={20} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {flex: 1, backgroundColor: colors.background},
  header: {paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border},
  title: {fontWeight: '900', fontSize: typography.h3, color: colors.text},
  list: {padding: spacing.md, gap: 8, flexGrow: 1},
  bubble: {maxWidth: '80%', borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 10, gap: 4},
  mine: {alignSelf: 'flex-end', backgroundColor: colors.primary},
  theirs: {alignSelf: 'flex-start', backgroundColor: colors.cardSolid, borderWidth: 1, borderColor: colors.border},
  msg: {color: colors.text, lineHeight: 20},
  msgMine: {color: '#fff'},
  time: {fontSize: 10, color: colors.textSecondary},
  timeMine: {color: 'rgba(255,255,255,0.8)'},
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardSolid,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.text,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
