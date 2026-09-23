import React, {useState} from 'react';
import {Alert, Pressable, StyleSheet, Text, View} from 'react-native';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {RootStackParamList} from '../../navigation/types';
import {Screen} from '../../components/Screen';
import {AppButton} from '../../components/AppButton';
import {
  adminCloseFound,
  adminCloseLost,
  getAdminMetrics,
  listAdminFoundPosts,
  listAdminLostPosts,
  listAdminOwnership,
  listAdminReports,
  resolveAdminReport,
  reviewOwnership,
} from '../../api/moderation.api';
import {getApiErrorMessage} from '../../api/client';
import {colors, radius, spacing, typography} from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Admin'>;
type Tab = 'overview' | 'ownership' | 'reports' | 'posts';

export function AdminScreen(_props: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('overview');
  const metrics = useQuery({queryKey: ['admin-metrics'], queryFn: getAdminMetrics});
  const ownership = useQuery({
    queryKey: ['admin-ownership'],
    queryFn: listAdminOwnership,
    enabled: tab === 'ownership',
  });
  const reports = useQuery({
    queryKey: ['admin-reports'],
    queryFn: () => listAdminReports('open'),
    enabled: tab === 'reports',
  });
  const lost = useQuery({
    queryKey: ['admin-lost'],
    queryFn: listAdminLostPosts,
    enabled: tab === 'posts',
  });
  const found = useQuery({
    queryKey: ['admin-found'],
    queryFn: listAdminFoundPosts,
    enabled: tab === 'posts',
  });

  const refresh = () => {
    void qc.invalidateQueries({queryKey: ['admin-metrics']});
    void qc.invalidateQueries({queryKey: ['admin-ownership']});
    void qc.invalidateQueries({queryKey: ['admin-reports']});
    void qc.invalidateQueries({queryKey: ['admin-lost']});
    void qc.invalidateQueries({queryKey: ['admin-found']});
  };

  return (
    <Screen>
      <View style={styles.tabs}>
        {(
          [
            ['overview', 'สรุป'],
            ['ownership', 'Ownership'],
            ['reports', 'รายงาน'],
            ['posts', 'โพสต์'],
          ] as const
        ).map(([id, label]) => (
          <Pressable key={id} onPress={() => setTab(id)} style={[styles.tab, tab === id && styles.tabActive]}>
            <Text style={[styles.tabText, tab === id && styles.tabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'overview' && metrics.data && (
        <View style={styles.grid}>
          <Metric label="ผู้ใช้" value={metrics.data.users} />
          <Metric label="หาย (active)" value={metrics.data.lost_active} />
          <Metric label="พบ (active)" value={metrics.data.found_active} />
          <Metric label="รายงานเปิด" value={metrics.data.reports_open} />
          <Metric label="Ownership รอตรวจ" value={metrics.data.ownership_pending} />
        </View>
      )}

      {tab === 'ownership' &&
        ownership.data?.map(row => (
          <View key={row.id} style={styles.card}>
            <Text style={styles.cardTitle}>{row.status.toUpperCase()} · {row.method}</Text>
            <Text style={styles.meta}>pet: {row.pet_id.slice(0, 8)}… · owner: {row.owner_id.slice(0, 8)}…</Text>
            {!!row.evidence_note && <Text style={styles.meta}>{row.evidence_note}</Text>}
            {row.status === 'pending' && (
              <View style={styles.row}>
                <AppButton
                  title="อนุมัติ"
                  style={{flex: 1}}
                  onPress={() =>
                    void reviewOwnership(row.id, {status: 'verified'})
                      .then(refresh)
                      .catch(e => Alert.alert(getApiErrorMessage(e)))
                  }
                />
                <AppButton
                  title="ปฏิเสธ"
                  variant="danger"
                  style={{flex: 1}}
                  onPress={() =>
                    void reviewOwnership(row.id, {status: 'rejected', reviewer_note: 'Insufficient evidence'})
                      .then(refresh)
                      .catch(e => Alert.alert(getApiErrorMessage(e)))
                  }
                />
              </View>
            )}
          </View>
        ))}

      {tab === 'reports' &&
        reports.data?.map(row => (
          <View key={row.id} style={styles.card}>
            <Text style={styles.cardTitle}>{row.reason} · {row.target_type}</Text>
            <Text style={styles.meta}>{row.details || 'ไม่มีรายละเอียด'}</Text>
            <View style={styles.row}>
              <AppButton
                title="ปิดเคส"
                style={{flex: 1}}
                onPress={() =>
                  void resolveAdminReport(row.id, {status: 'resolved'})
                    .then(refresh)
                    .catch(e => Alert.alert(getApiErrorMessage(e)))
                }
              />
              <AppButton
                title="ยกเลิก"
                variant="outline"
                style={{flex: 1}}
                onPress={() =>
                  void resolveAdminReport(row.id, {status: 'dismissed'})
                    .then(refresh)
                    .catch(e => Alert.alert(getApiErrorMessage(e)))
                }
              />
            </View>
          </View>
        ))}

      {tab === 'posts' && (
        <>
          <Text style={styles.section}>Lost</Text>
          {lost.data?.slice(0, 20).map(p => (
            <View key={p.id} style={styles.card}>
              <Text style={styles.cardTitle}>{p.title} · {p.status}</Text>
              <Text style={styles.meta}>{p.location_text || `${p.latitude}, ${p.longitude}`}</Text>
              {p.status === 'active' && (
                <AppButton
                  title="ปิดประกาศ"
                  variant="danger"
                  onPress={() =>
                    void adminCloseLost(p.id)
                      .then(refresh)
                      .catch(e => Alert.alert(getApiErrorMessage(e)))
                  }
                />
              )}
            </View>
          ))}
          <Text style={styles.section}>Found</Text>
          {found.data?.slice(0, 20).map(p => (
            <View key={p.id} style={styles.card}>
              <Text style={styles.cardTitle}>{p.animal_type} · {p.status}</Text>
              <Text style={styles.meta}>{p.location_text || '—'}</Text>
              {p.status === 'active' && (
                <AppButton
                  title="ปิดโพสต์"
                  variant="danger"
                  onPress={() =>
                    void adminCloseFound(p.id)
                      .then(refresh)
                      .catch(e => Alert.alert(getApiErrorMessage(e)))
                  }
                />
              )}
            </View>
          ))}
        </>
      )}
    </Screen>
  );
}

function Metric({label, value}: {label: string; value: number}) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {flexDirection: 'row', gap: 6, flexWrap: 'wrap'},
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.cardSolid,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: {backgroundColor: colors.primary, borderColor: colors.primary},
  tabText: {fontWeight: '700', color: colors.textSecondary, fontSize: 12},
  tabTextActive: {color: '#fff'},
  grid: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  metric: {
    width: '48%',
    backgroundColor: colors.cardSolid,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricValue: {fontSize: typography.h1, fontWeight: '900', color: colors.text},
  metricLabel: {color: colors.textSecondary, marginTop: 4},
  card: {
    backgroundColor: colors.cardSolid,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  cardTitle: {fontWeight: '900', color: colors.text},
  meta: {color: colors.textSecondary, fontSize: typography.small, lineHeight: 18},
  row: {flexDirection: 'row', gap: 8},
  section: {fontWeight: '900', fontSize: typography.h3, color: colors.text, marginTop: 8},
});
