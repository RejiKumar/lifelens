import { render, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import PreviewScreen from '@/app/preview';
import type { NormalizedImage, ScanResponse } from '@/features/scan/domain/types';
import type { ScanFlowState } from '@/features/scan/domain/scan-state';
import { useScanFlow } from '@/features/scan/presentation/scan-context';

const image: NormalizedImage = {
  uri: 'file:///preview.jpg',
  name: 'preview.jpg',
  type: 'image/jpeg',
  width: 1200,
  height: 800,
  sizeBytes: 245760,
  source: 'camera',
};

const result: ScanResponse = {
  id: 'scan-1',
  status: 'completed',
  created_at: '2026-01-01T00:00:00Z',
  analysis: null,
  safety: {
    risk_level: 'LOW',
    is_medical: false,
    is_hazardous: false,
    is_electrical: false,
    is_structural: false,
    is_vehicle: false,
    is_chemical: false,
    is_gas: false,
  },
  quota: null,
};

jest.mock('expo-router', () => ({
  useRouter: () => ({
    dismiss: jest.fn(),
    push: jest.fn(),
  }),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
}));

jest.mock('expo-image', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { Image: () => null };
});

jest.mock('@/features/scan/presentation/scan-context', () => ({
  useScanFlow: jest.fn(),
}));

const mockedUseScanFlow = jest.mocked(useScanFlow);

const contextValue = (state: ScanFlowState) => ({
  state,
  prepareImage: jest.fn(),
  analyze: jest.fn(),
  retry: jest.fn(),
  cancel: jest.fn(),
  reset: jest.fn(),
  fetchResult: jest.fn(),
});

describe('PreviewScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseScanFlow.mockReturnValue(
      contextValue({
        stage: 'preview',
        image,
        result: null,
        error: null,
        scanId: null,
        quota: null,
        startedAtMs: null,
      }),
    );
  });

  const renderScreen = () =>
    render(
      <SafeAreaProvider
        initialMetrics={{
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
          frame: { x: 0, y: 0, width: 390, height: 844 },
        }}>
        <PreviewScreen />
      </SafeAreaProvider>,
    );

  it('renders the retake and analyze CTAs', async () => {
    const { getByText } = await renderScreen();
    expect(getByText('Retake')).toBeTruthy();
    expect(getByText('Analyze')).toBeTruthy();
  });

  it('runs analysis via the analyze CTA', async () => {
    const value = contextValue({
      stage: 'preview',
      image,
      result: null,
      error: null,
      scanId: null,
      quota: null,
      startedAtMs: null,
    });
    const analyze = jest.fn().mockResolvedValue(result);
    value.analyze = analyze;
    mockedUseScanFlow.mockReturnValue(value);
    const { getByText } = await renderScreen();
    fireEvent.press(getByText('Analyze'));
    expect(analyze).toHaveBeenCalled();
  });

  it('shows an empty state when no image is selected', async () => {
    mockedUseScanFlow.mockReturnValue(
      contextValue({
        stage: 'idle',
        image: null,
        result: null,
        error: null,
        scanId: null,
        quota: null,
        startedAtMs: null,
      }),
    );
    const { getByText } = await renderScreen();
    expect(getByText(/No image selected/i)).toBeTruthy();
  });
});