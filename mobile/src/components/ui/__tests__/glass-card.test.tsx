import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

jest.mock('expo-blur', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    BlurView: ({ children, style }: { children: React.ReactNode; style?: object }) => (
      <View style={style as object}>{children}</View>
    ),
  };
});

jest.mock('@/features/scan/presentation/use-reduced-motion', () => ({
  useReducedMotion: () => false,
}));

import { GlassCard } from '@/components/ui/glass-card';

describe('GlassCard', () => {
  it('renders its children', async () => {
    const { getByText } = await render(
      <GlassCard>
        <Text>Hello</Text>
      </GlassCard>,
    );
    expect(getByText('Hello')).toBeTruthy();
  });
});