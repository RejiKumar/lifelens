import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

jest.mock('expo-blur', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    BlurView: ({ children, testID, style }: { children?: React.ReactNode; testID?: string; style?: object }) => (
      <View testID={testID ?? 'blur'} style={style as object}>
        {children}
      </View>
    ),
  };
});

jest.mock('expo-glass-effect', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    GlassView: ({ children, style }: { children?: React.ReactNode; style?: object }) => (
      <View testID="glass" style={style as object}>
        {children}
      </View>
    ),
    isGlassEffectAPIAvailable: () => false,
    isLiquidGlassAvailable: () => false,
  };
});

jest.mock('@/features/scan/presentation/use-reduced-motion', () => ({
  useReducedMotion: () => false,
}));

import { GlassSurface } from '@/components/ui/glass-surface';
import { Radius } from '@/constants/theme';

describe('GlassSurface', () => {
  it('renders a translucent surface (BlurView) with children', async () => {
    const { getByTestId, getByText } = await render(
      <GlassSurface testID="translucent">
        <Text>Inside</Text>
      </GlassSurface>,
    );
    expect(getByTestId('translucent')).toBeTruthy();
    expect(getByText('Inside')).toBeTruthy();
  });

  it('falls back to an opaque surface with the surface token', async () => {
    const { getByTestId } = await render(
      <GlassSurface testID="opaque" variant="opaque">
        <Text>Opaque</Text>
      </GlassSurface>,
    );
    const surface = getByTestId('opaque');
    expect(surface.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ borderRadius: Radius.standard })]),
    );
  });
});