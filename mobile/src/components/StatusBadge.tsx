import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useI18n} from '../i18n/useI18n';
import {colors, radius} from '../theme';

export function StatusBadge({status}: {status: string}) {
  const t = useI18n(s => s.t);
  const lost = status === 'lost' || status === 'active';
  const label =
    status === 'lost' ? t('statusLost') : status === 'active' ? t('statusActive') : status === 'safe' ? t('statusSafe') : status;
  return (
    <View style={[styles.badge, {backgroundColor: lost ? colors.emergencyMuted : colors.primaryMuted}]}>
      <Text style={[styles.text, {color: lost ? colors.emergency : colors.primaryDark}]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full},
  text: {fontSize: 12, fontWeight: '800'},
});
