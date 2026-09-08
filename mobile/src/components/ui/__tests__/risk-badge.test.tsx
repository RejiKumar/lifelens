import { render } from '@testing-library/react-native';

import { RiskBadge } from '@/components/ui/risk-badge';

describe('RiskBadge', () => {
  it('maps CRITICAL to an error-tier badge', async () => {
    const { getByLabelText } = await render(<RiskBadge riskLevel="CRITICAL" />);
    expect(getByLabelText(/Critical risk/i)).toBeTruthy();
  });

  it('maps HIGH to a warning-tier badge', async () => {
    const { getByLabelText } = await render(<RiskBadge riskLevel="HIGH" />);
    expect(getByLabelText(/High risk/i)).toBeTruthy();
  });

  it('maps MEDIUM to an info-tier badge', async () => {
    const { getByLabelText } = await render(<RiskBadge riskLevel="MEDIUM" />);
    expect(getByLabelText(/Moderate risk/i)).toBeTruthy();
  });

  it('maps LOW to a success-tier badge', async () => {
    const { getByLabelText } = await render(<RiskBadge riskLevel="LOW" />);
    expect(getByLabelText(/Low risk/i)).toBeTruthy();
  });
});