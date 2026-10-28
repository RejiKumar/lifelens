import { act, fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

const mockUseReducedMotion = jest.fn(() => false);

jest.mock('@/features/scan/presentation/use-reduced-motion', () => ({
  useReducedMotion: () => mockUseReducedMotion(),
}));

import { FadeIn, FadeInUp, PressableScale, Reveal } from '@/components/ui/micro-motion';

describe('MicroMotion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseReducedMotion.mockImplementation(() => false);
  });

  it('renders children inside animated wrappers', async () => {
    const fade = await render(
      <FadeIn>
        <Text>Faded</Text>
      </FadeIn>,
    );
    expect(fade.getByText('Faded')).toBeTruthy();

    const up = await render(
      <FadeInUp>
        <Text>Up</Text>
      </FadeInUp>,
    );
    expect(up.getByText('Up')).toBeTruthy();

    const reveal = await render(
      <Reveal>
        <Text>Revealed</Text>
      </Reveal>,
    );
    expect(reveal.getByText('Revealed')).toBeTruthy();
  });

  it('handles press feedback on PressableScale', async () => {
    const onPressIn = jest.fn();
    const onPressOut = jest.fn();
    const { getByLabelText } = await render(
      <PressableScale accessibilityLabel="press" onPressIn={onPressIn} onPressOut={onPressOut}>
        <Text>Tap</Text>
      </PressableScale>,
    );
    await act(async () => {
      fireEvent(getByLabelText('press'), 'pressIn');
    });
    await act(async () => {
      fireEvent(getByLabelText('press'), 'pressOut');
    });
    expect(onPressIn).toHaveBeenCalledTimes(1);
    expect(onPressOut).toHaveBeenCalledTimes(1);
  });

  it('still renders children under reduced motion', async () => {
    mockUseReducedMotion.mockImplementation(() => true);
    const { getByText } = await render(
      <FadeInUp>
        <Text>Static</Text>
      </FadeInUp>,
    );
    expect(getByText('Static')).toBeTruthy();
  });
});