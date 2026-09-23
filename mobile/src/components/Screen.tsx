import React, {PropsWithChildren} from 'react';
import {ScrollView, StyleSheet, View, ViewStyle} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {colors, spacing} from '../theme';

type Props = PropsWithChildren<{
  scroll?: boolean;
  contentStyle?: ViewStyle;
  paddedBottom?: boolean;
}>;

export function Screen({children, scroll = true, contentStyle, paddedBottom = true}: Props) {
  const bottomPad = paddedBottom ? {paddingBottom: 110} : undefined;
  if (!scroll) {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={[styles.content, styles.flex, bottomPad, contentStyle]}>{children}</View>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScrollView
        contentContainerStyle={[styles.content, bottomPad, contentStyle]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.background},
  flex: {flex: 1},
  content: {padding: spacing.md, gap: spacing.md},
});
