import React from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle} from 'react-native';
import {AppIcon} from './AppIcon';
import {colors, radius, shadow, typography} from '../theme';

type Props = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost';
  icon?: string;
  style?: ViewStyle;
};

export function AppButton({title, onPress, loading, disabled, variant = 'primary', icon, style}: Props) {
  const variantStyle = {
    primary: styles.primary,
    secondary: styles.secondary,
    danger: styles.danger,
    outline: styles.outline,
    ghost: styles.ghost,
  }[variant];
  const textStyle =
    variant === 'outline' || variant === 'ghost' ? styles.darkText : styles.lightText;
  const iconColor =
    variant === 'outline' || variant === 'ghost' ? colors.primaryDark : colors.textInverse;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({pressed}) => [
        styles.base,
        variantStyle,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={iconColor} />
      ) : (
        <>
          {!!icon && <AppIcon name={icon} size={18} color={iconColor} />}
          <Text style={[styles.text, textStyle]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    flexDirection: 'row',
    gap: 8,
    ...shadow.soft,
  },
  primary: {backgroundColor: colors.primary},
  secondary: {backgroundColor: colors.secondary},
  danger: {backgroundColor: colors.emergency},
  outline: {
    backgroundColor: colors.cardSolid,
    borderWidth: 1.5,
    borderColor: colors.primary,
    shadowOpacity: 0,
    elevation: 0,
  },
  ghost: {
    backgroundColor: colors.primaryMuted,
    shadowOpacity: 0,
    elevation: 0,
  },
  pressed: {opacity: 0.86, transform: [{scale: 0.985}]},
  disabled: {opacity: 0.45},
  text: {fontSize: typography.body, fontWeight: '700'},
  lightText: {color: colors.textInverse},
  darkText: {color: colors.primaryDark},
});
