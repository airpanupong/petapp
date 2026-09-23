export const colors = {
  primary: '#0F8F7E',
  primaryDark: '#0A6B5E',
  primaryMuted: '#E6F6F3',
  primaryLight: '#E6F6F3',
  secondary: '#F07A45',
  secondaryMuted: '#FFF1EA',
  secondaryLight: '#FFF1EA',
  background: '#F3F6F5',
  backgroundAlt: '#EAF2F0',
  card: '#FFFFFF',
  cardSolid: '#FFFFFF',
  glass: 'rgba(255,255,255,0.72)',
  glassBorder: 'rgba(255,255,255,0.55)',
  glassDark: 'rgba(15, 40, 38, 0.55)',
  text: '#15231F',
  textSecondary: '#5F726C',
  textInverse: '#FFFFFF',
  border: 'rgba(21, 35, 31, 0.08)',
  success: '#2F9E6E',
  info: '#3B82A8',
  warning: '#E2A03A',
  emergency: '#E05252',
  emergencyMuted: '#FCEAEA',
  accent: '#F5C76B',
  overlay: 'rgba(12, 28, 26, 0.42)',
  shadow: '#0C1C1A',
};

export const radius = {sm: 12, md: 18, lg: 24, xl: 32, full: 999};
export const spacing = {xs: 6, sm: 10, md: 16, lg: 22, xl: 30, xxl: 40};

export const typography = {
  display: 34,
  h1: 28,
  h2: 22,
  h3: 18,
  body: 16,
  small: 14,
  caption: 12,
};

export const shadow = {
  soft: {
    shadowColor: colors.shadow,
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  float: {
    shadowColor: colors.shadow,
    shadowOffset: {width: 0, height: 12},
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
};
