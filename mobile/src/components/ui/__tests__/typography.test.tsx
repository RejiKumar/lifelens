import { render } from '@testing-library/react-native';

jest.mock('@/features/scan/presentation/use-reduced-motion', () => ({
  useReducedMotion: () => false,
}));

import { Typography } from '@/components/ui/typography';
import { Typography as TypeScale } from '@/constants/theme';

describe('Typography', () => {
  it('applies the display step and default text color', async () => {
    const { getByText } = await render(<Typography variant="display">Hello</Typography>);
    const el = getByText('Hello');
    expect(el.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ fontSize: TypeScale.display.fontSize })]),
    );
    expect(el.props.allowFontScaling).toBe(true);
  });

  it('renders a secondary caption', async () => {
    const { getByText } = await render(
      <Typography variant="caption" themeColor="textSecondary">
        Small
      </Typography>,
    );
    const el = getByText('Small');
    expect(el.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ fontSize: TypeScale.caption.fontSize })]),
    );
  });
});