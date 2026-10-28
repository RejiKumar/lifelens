/**
 * LifeLens v2 design tokens.
 * All layout spacing MUST come from the Spacing scale; all radii from Radius;
 * type from Typography; motion durations from Motion. No raw literals.
 */

import '@/global.css';

import { Platform, type TextStyle } from 'react-native';

export type ResolvedTheme = 'light' | 'dark';

export interface ThemeTokens {
  text: string;
  textSecondary: string;
  background: string;
  surface: string;
  tabBar: string;
  backgroundElement: string;
  backgroundSelected: string;
  accent: string;
  accentText: string;
  glassTint: string;
  glassTintStrong: string;
  hairline: string;
  overlay: string;
  onCamera: string;
  auroraTop: string;
  auroraMid: string;
  auroraBottom: string;
  shadow: string;
  shadowStrong: string;
}

export const Colors: Record<ResolvedTheme, ThemeTokens> = {
  light: {
    text: '#0B0E14',
    textSecondary: '#4A5568',
    background: '#FAFAFC',
    surface: '#FFFFFF',
    tabBar: 'rgba(255,255,255,0.60)',
    backgroundElement: '#EEF0F6',
    backgroundSelected: '#E2E6F0',
    accent: '#7C5CFF',
    accentText: '#FFFFFF',
    glassTint: 'rgba(255,255,255,0.62)',
    glassTintStrong: 'rgba(255,255,255,0.78)',
    hairline: 'rgba(15,23,42,0.08)',
    overlay: 'rgba(11,14,20,0.35)',
    onCamera: '#FFFFFF',
    auroraTop: '#D8C9FF',
    auroraMid: '#BFE3FF',
    auroraBottom: '#FFE9E0',
    shadow: 'rgba(11,14,20,0.10)',
    shadowStrong: 'rgba(11,14,20,0.18)',
  },
  dark: {
    text: '#F5F7FF',
    textSecondary: '#A8B0C3',
    background: '#06070B',
    surface: '#12141C',
    tabBar: 'rgba(0,0,0,0.60)',
    backgroundElement: '#1B1E29',
    backgroundSelected: '#262A38',
    accent: '#B79CFF',
    accentText: '#0B0E14',
    glassTint: 'rgba(18,20,28,0.55)',
    glassTintStrong: 'rgba(18,20,28,0.72)',
    hairline: 'rgba(245,247,255,0.10)',
    overlay: 'rgba(0,0,0,0.5)',
    onCamera: '#FFFFFF',
    auroraTop: '#6D28D9',
    auroraMid: '#2563EB',
    auroraBottom: '#DB2777',
    shadow: 'rgba(0,0,0,0.5)',
    shadowStrong: 'rgba(0,0,0,0.72)',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const RISK_COLORS: Record<string, string> = {
  LOW: '#16A34A',
  MEDIUM: '#D97706',
  HIGH: '#EA580C',
  CRITICAL: '#DC2626',
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

/**
 * Legacy spacing scale (kept stable for existing components — do not renumber).
 * New layouts MUST use `Size`, the canonical 4-pt base scale below.
 */
export const Spacing = {
  half: 2,
  one: 4,
  oneHalf: 6,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/**
 * Canonical 4-pt base spacing scale for all new/redesigned layouts.
 * Every margin, padding, and gap MUST come from here (no raw literals).
 */
export const Size = {
  min: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
  xhuge: 64,
} as const;

export const Radius = {
  small: 12,
  standard: 16,
  elevated: 20,
  featured: 24,
} as const;

type FontWeight = TextStyle['fontWeight'];

export interface TypeStep {
  fontSize: number;
  lineHeight: number;
  fontWeight: FontWeight;
}

export const Typography = {
  display: { fontSize: 34, lineHeight: 44, fontWeight: '700' },
  largeTitle: { fontSize: 28, lineHeight: 38, fontWeight: '700' },
  title: { fontSize: 22, lineHeight: 30, fontWeight: '600' },
  subheadline: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
} satisfies Record<string, TypeStep>;

export type TypeStepName = keyof typeof Typography;

export const Motion = {
  entry: 260,
  chip: 200,
  reveal: 240,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;