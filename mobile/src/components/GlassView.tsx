import React, {PropsWithChildren} from 'react';
import {StyleSheet, View, ViewStyle} from 'react-native';

import {colors, shadow} from '../theme';

type Props = PropsWithChildren<{
  style?: ViewStyle;
  intensity?: 'light' | 'strong';
}>;

export function GlassView({children, style, intensity = 'light'}: Props) {
  return (
    <View
      style={[
        styles.base,
        intensity === 'strong' ? styles.strong : styles.light,
        shadow.soft,
        style,
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderColor: colors.glassBorder,
    overflow: 'hidden',
  },
  light: {
    backgroundColor: colors.glass,
  },
  strong: {
    backgroundColor: 'rgba(255,255,255,0.86)',
  },
});
