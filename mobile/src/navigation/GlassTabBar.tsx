import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import type {BottomTabBarProps} from '@react-navigation/bottom-tabs';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {AppIcon} from '../components/AppIcon';
import {GlassView} from '../components/GlassView';
import {useI18n} from '../i18n/useI18n';
import {MainTabParamList} from './types';
import {colors, radius, spacing} from '../theme';

const tabMeta: Record<keyof MainTabParamList, {icon: string; iconFocused: string; labelKey: 'tabs_home' | 'tabs_nearby' | 'tabs_report' | 'tabs_myPets' | 'tabs_profile'}> = {
  Home: {icon: 'home-outline', iconFocused: 'home', labelKey: 'tabs_home'},
  Nearby: {icon: 'navigate-outline', iconFocused: 'navigate', labelKey: 'tabs_nearby'},
  Report: {icon: 'add-circle-outline', iconFocused: 'add-circle', labelKey: 'tabs_report'},
  MyPets: {icon: 'paw-outline', iconFocused: 'paw', labelKey: 'tabs_myPets'},
  Profile: {icon: 'person-outline', iconFocused: 'person', labelKey: 'tabs_profile'},
};

export function GlassTabBar({state, descriptors, navigation}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const t = useI18n(s => s.t);

  return (
    <View style={[styles.wrap, {paddingBottom: Math.max(insets.bottom, 10)}]} pointerEvents="box-none">
      <GlassView intensity="strong" style={styles.bar}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const meta = tabMeta[route.name as keyof MainTabParamList];
          const options = descriptors[route.key]?.options;
          const onPress = () => {
            const event = navigation.emit({type: 'tabPress', target: route.key, canPreventDefault: true});
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? {selected: true} : {}}
              accessibilityLabel={options?.tabBarAccessibilityLabel}
              onPress={onPress}
              style={styles.item}>
              <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
                <AppIcon
                  name={focused ? meta.iconFocused : meta.icon}
                  size={route.name === 'Report' ? 28 : 22}
                  color={focused ? colors.primaryDark : colors.textSecondary}
                />
              </View>
              <Text style={[styles.label, focused && styles.labelActive]} numberOfLines={1}>
                {t(meta.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </GlassView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.xl,
    paddingHorizontal: 8,
    paddingVertical: 8,
    minHeight: 68,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  iconWrap: {
    width: 42,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: colors.primaryMuted,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  labelActive: {
    color: colors.primaryDark,
  },
});
