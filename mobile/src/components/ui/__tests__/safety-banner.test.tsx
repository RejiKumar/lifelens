import { render } from '@testing-library/react-native';

import { SafetyBanner } from '@/components/ui/safety-banner';

describe('SafetyBanner', () => {
  it('renders nothing for LOW risk', async () => {
    const { toJSON } = await render(<SafetyBanner riskLevel="LOW" isMedicine={false} />);
    expect(toJSON()).toBeNull();
  });

  it('renders a warning label for MEDIUM risk', async () => {
    const { getByText, queryByText } = await render(<SafetyBanner riskLevel="MEDIUM" isMedicine={false} />);
    expect(getByText(/Moderate risk/i)).toBeTruthy();
    expect(queryByText(/Not medical advice/i)).toBeNull();
  });

  it('renders critical label for CRITICAL risk', async () => {
    const { getByText } = await render(<SafetyBanner riskLevel="CRITICAL" isMedicine={false} />);
    expect(getByText(/CRITICAL RISK/i)).toBeTruthy();
  });

  it('shows medical disclaimer when flagged medical', async () => {
    const { getByText } = await render(<SafetyBanner riskLevel="HIGH" isMedicine={true} />);
    expect(getByText(/Not medical advice/i)).toBeTruthy();
  });
});