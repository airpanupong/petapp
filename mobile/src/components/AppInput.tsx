import React from 'react';
import {StyleSheet, Text, TextInput, TextInputProps, View} from 'react-native';
import {colors, radius, spacing, typography} from '../theme';

type Props = TextInputProps & {label: string; error?: string};

export function AppInput({label, error, style, ...props}: Props) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor="#8A9A94"
        style={[styles.input, !!error && styles.inputError, style]}
        {...props}
      />
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {gap: spacing.xs},
  label: {fontSize: typography.small, fontWeight: '700', color: colors.text},
  input: {
    minHeight: 54,
    backgroundColor: colors.cardSolid,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    color: colors.text,
    fontSize: typography.body,
  },
  inputError: {borderColor: colors.emergency},
  error: {color: colors.emergency, fontSize: typography.caption},
});
