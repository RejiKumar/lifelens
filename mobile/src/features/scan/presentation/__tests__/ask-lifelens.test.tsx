import { fireEvent, render } from '@testing-library/react-native';

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

import { AskLifeLensCard } from '@/features/scan/presentation/ask-lifelens';

describe('AskLifeLensCard', () => {
  it('renders suggestion chips from follow_up_suggestions', async () => {
    const { getByText, getByLabelText, queryByLabelText } = await render(
      <AskLifeLensCard
        suggestions={['What is this made of?', 'How do I clean it?', 'Is it safe?']}
        onAsk={jest.fn()}
      />,
    );
    expect(getByText('Ask about what you see')).toBeTruthy();
    expect(getByLabelText(/Ask: What is this made of\?/i)).toBeTruthy();
    expect(getByLabelText(/Ask: How do I clean it\?/i)).toBeTruthy();
    expect(queryByLabelText(/Ask: Is it safe\?/i)).toBeNull();
  });

  it('submits the exact chip question on tap', async () => {
    const onAsk = jest.fn();
    const { getByLabelText } = await render(
      <AskLifeLensCard suggestions={['Tell me more']} onAsk={onAsk} />,
    );
    await fireEvent.press(getByLabelText(/Ask: Tell me more/i));
    expect(onAsk).toHaveBeenCalledWith('Tell me more');
  });

  it('does not fire when disabled', async () => {
    const onAsk = jest.fn();
    const { getByLabelText } = await render(
      <AskLifeLensCard suggestions={['Tell me more']} onAsk={onAsk} disabled />,
    );
    await fireEvent.press(getByLabelText(/Ask: Tell me more/i));
    expect(onAsk).not.toHaveBeenCalled();
  });

  it('ignores blank suggestions and caps at two chips', async () => {
    const { getByLabelText, queryByLabelText } = await render(
      <AskLifeLensCard
        suggestions={['  ', 'First', 'Second', 'Third']}
        onAsk={jest.fn()}
      />,
    );
    expect(queryByLabelText(/Ask: First/i)).not.toBeNull();
    expect(queryByLabelText(/Ask: Second/i)).not.toBeNull();
    expect(queryByLabelText(/Ask: Third/i)).toBeNull();
  });
});