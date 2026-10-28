import { render } from '@testing-library/react-native';
import { View } from 'react-native';

jest.mock('expo-linear-gradient', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    LinearGradient: (props: { style?: object; testID?: string }) => (
      <View style={props.style as object} testID="aurora-gradient" />
    ),
  };
});

const mockUseReducedMotion = jest.fn(() => false);

jest.mock('@/features/scan/presentation/use-reduced-motion', () => ({
  useReducedMotion: () => mockUseReducedMotion(),
}));

import { AuroraBackground } from '@/components/ui/aurora-background';

describe('AuroraBackground', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseReducedMotion.mockImplementation(() => false);
  });

  it('renders the three aurora gradient blobs', async () => {
    const { getAllByTestId } = await render(<AuroraBackground />);
    expect(getAllByTestId('aurora-gradient')).toHaveLength(3);
  });

  it('still renders the palette when reduced motion is enabled', async () => {
    mockUseReducedMotion.mockImplementation(() => true);
    const { getAllByTestId } = await render(<AuroraBackground />);
    expect(getAllByTestId('aurora-gradient')).toHaveLength(3);
  });
});