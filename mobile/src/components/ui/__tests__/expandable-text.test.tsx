import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('@/features/scan/presentation/use-reduced-motion', () => ({
  useReducedMotion: () => false,
}));

import { ExpandableText } from '@/components/ui/expandable-text';

describe('ExpandableText', () => {
  it('shows no expand control for short text', async () => {
    const { queryByLabelText, getByText } = await render(
      <ExpandableText text="Short text" numberOfLines={3} />,
    );
    expect(getByText('Short text').props.numberOfLines).toBeUndefined();
    expect(queryByLabelText('Show more')).toBeNull();
  });

  it('clamps overflowing text and toggles More/Less', async () => {
    const longText = Array.from({ length: 20 }, (_, i) => `Line ${i}`).join('\n');
    const { getByText, getByLabelText } = await render(
      <ExpandableText text={longText} numberOfLines={3} />,
    );

    const textElement = getByText(longText);
    await act(async () => {
      textElement.props.onTextLayout({
        nativeEvent: { lines: Array.from({ length: 20 }, () => ({ text: 'x' })) },
      });
    });

    const more = getByLabelText('Show more');
    expect(more).toBeTruthy();
    expect(textElement.props.numberOfLines).toBe(3);

    await act(async () => {
      fireEvent.press(more);
    });
    const less = getByLabelText('Show less');
    expect(less).toBeTruthy();

    await act(async () => {
      fireEvent.press(less);
    });
    expect(getByLabelText('Show more')).toBeTruthy();
  });
});