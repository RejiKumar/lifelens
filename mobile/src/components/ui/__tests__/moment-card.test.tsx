import { render } from '@testing-library/react-native';

import { MomentCard } from '@/components/ui/moment-card';

describe('MomentCard', () => {
  it('renders the headline and action', async () => {
    const { getByLabelText, getByText } = await render(
      <MomentCard headline="It is safe." action="No immediate action required." />,
    );
    expect(getByText('It is safe.')).toBeTruthy();
    expect(getByText('No immediate action required.')).toBeTruthy();
    expect(getByLabelText(/It is safe\./i)).toBeTruthy();
  });

  it('renders nothing when headline is empty', async () => {
    const { queryByLabelText } = await render(<MomentCard headline="" action="No immediate action required." />);
    expect(queryByLabelText(/Moment:/i)).toBeNull();
  });

  it('renders nothing when action is empty', async () => {
    const { queryByLabelText } = await render(<MomentCard headline="It is safe." action="" />);
    expect(queryByLabelText(/Moment:/i)).toBeNull();
  });

  it('renders nothing when values are whitespace', async () => {
    const { queryByLabelText } = await render(<MomentCard headline="   " action="   " />);
    expect(queryByLabelText(/Moment:/i)).toBeNull();
  });
});
