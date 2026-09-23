import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {colors, typography} from '../theme';

export function SectionHeader({title, action, onAction}: {title: string; action?: string; onAction?: () => void}) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {!!action && (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={styles.action}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  title: {fontSize: typography.h3, fontWeight: '800', color: colors.text, letterSpacing: -0.2},
  action: {fontSize: typography.small, fontWeight: '700', color: colors.primaryDark},
});
