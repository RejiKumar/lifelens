import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AnalysisScreen from '@/app/analysis/[id]';
import type { ScanResponse } from '@/features/scan/domain/types';
import type { ScanFlowState } from '@/features/scan/domain/scan-state';
import { useScanFlow } from '@/features/scan/presentation/scan-context';

const baseAnalysis = {
  title: 'A thing',
  category: 'object',
  summary: 'It is a thing.',
  confidence: 0.9,
  risk_level: 'LOW' as const,
  observations: [],
  actions: [],
  warnings: [],
  when_to_seek_help: null,
  follow_up_suggestions: [],
  moment: { headline: 'It is safe.', action: 'No immediate action required.' },
};

const safety = {
  risk_level: 'LOW' as const,
  is_medical: false,
  is_hazardous: false,
  is_electrical: false,
  is_structural: false,
  is_vehicle: false,
  is_chemical: false,
  is_gas: false,
};

const lowResult: ScanResponse = {
  id: 'scan-1',
  status: 'completed',
  created_at: '2026-01-01T00:00:00Z',
  analysis: baseAnalysis,
  safety,
  quota: null,
};

const highResult: ScanResponse = {
  ...lowResult,
  analysis: {
    ...baseAnalysis,
    risk_level: 'HIGH',
    moment: { headline: 'Handle with caution.', action: 'Evacuate the area and call for help.' },
  },
  safety: { ...safety, risk_level: 'HIGH', is_electrical: true },
};

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(() => ({ id: 'scan-1' })),
  useRouter: () => ({
    dismiss: jest.fn(),
    push: jest.fn(),
  }),
}));

jest.mock('@/features/scan/presentation/scan-context', () => ({
  useScanFlow: jest.fn(),
}));

const mockedUseScanFlow = jest.mocked(useScanFlow);

const stateFor = (result: ScanResponse): ScanFlowState => ({
  stage: 'success',
  image: null,
  result,
  error: null,
  scanId: result.id,
  quota: null,
  startedAtMs: null,
});

const contextValue = (result: ScanResponse) => ({
  state: stateFor(result),
  prepareImage: jest.fn(),
  analyze: jest.fn(),
  retry: jest.fn(),
  cancel: jest.fn(),
  reset: jest.fn(),
  fetchResult: jest.fn(),
});

const renderScreen = () =>
  render(
    <SafeAreaProvider
      initialMetrics={{
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
        frame: { x: 0, y: 0, width: 390, height: 844 },
      }}>
      <AnalysisScreen />
    </SafeAreaProvider>,
  );

function momentPosition(json: unknown): number {
  const text = JSON.stringify(json);
  return text.indexOf('It is safe.');
}

function riskPosition(json: unknown): number {
  const text = JSON.stringify(json);
  return text.indexOf('Low risk');
}

describe('AnalysisScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the moment above the risk badge for LOW risk', async () => {
    mockedUseScanFlow.mockReturnValue(contextValue(lowResult));
    const { getByText, getByLabelText, toJSON } = await renderScreen();
    expect(getByLabelText(/Moment:/i)).toBeTruthy();
    expect(getByText('Low risk')).toBeTruthy();
    const json = toJSON();
    expect(momentPosition(json)).toBeGreaterThanOrEqual(0);
    expect(riskPosition(json)).toBeGreaterThanOrEqual(0);
    expect(momentPosition(json)).toBeLessThan(riskPosition(json));
  });

  it('renders the risk badge and safety banner alongside the moment for HIGH risk', async () => {
    mockedUseScanFlow.mockReturnValue(contextValue(highResult));
    const { getByLabelText, getByText } = await renderScreen();
    expect(getByLabelText(/Moment: Handle with caution/i)).toBeTruthy();
    expect(getByText('High risk')).toBeTruthy();
    expect(getByText(/High risk — Use caution/i)).toBeTruthy();
  });
});
