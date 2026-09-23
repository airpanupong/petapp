import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {AppIcon} from './AppIcon';
import {useI18n} from '../i18n/useI18n';
import {colors, radius, spacing, typography} from '../theme';

export function EmptyState({
  icon = 'paw',
  title,
  description,
}: {
  icon?: string;
  title: string;
  description?: string;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.bubble}>
        <AppIcon name={icon} size={34} color={colors.primaryDark} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {!!description && <Text style={styles.description}>{description}</Text>}
    </View>
  );
}

export function EmptyStateI18n({
  icon,
  titleKey,
  descriptionKey,
}: {
  icon?: string;
  titleKey: Parameters<ReturnType<typeof useI18n.getState>['t']>[0];
  descriptionKey?: Parameters<ReturnType<typeof useI18n.getState>['t']>[0];
}) {
  const t = useI18n(s => s.t);
  return (
    <EmptyState
      icon={icon}
      title={t(titleKey)}
      description={descriptionKey ? t(descriptionKey) : undefined}
    />
  );
}

const styles = StyleSheet.create({
  wrap: {alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm},
  bubble: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {fontSize: typography.h3, fontWeight: '800', color: colors.text, textAlign: 'center'},
  description: {fontSize: typography.small, color: colors.textSecondary, textAlign: 'center', maxWidth: 300, lineHeight: 20},
});
