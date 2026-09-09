import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AnalysisScreen from '@/app/analysis/[id]';
import type { ChatMessage, ScanResponse } from '@/features/scan/domain/types';
import type { ScanFlowState } from '@/features/scan/domain/scan-state';
import { useScanFlow } from '@/features/scan/presentation/scan-context';
import { useConversation } from '@/features/scan/presentation/use-conversation';

const baseAnalysis = {
  id: 'analysis-1',
  scan_id: 'scan-1',
  title: 'A thing',
  category: 'object',
  summary: 'It is a thing.',
  confidence: 0.9,
  risk_level: 'LOW' as const,
  observations: [],
  actions: [],
  warnings: [],
  when_to_seek_help: null,
  follow_up_suggestions: ['What is this made of?', 'How do I clean it?'],
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

jest.mock('@/features/scan/presentation/use-conversation', () => ({
  useConversation: jest.fn(),
}));

const mockedUseScanFlow = jest.mocked(useScanFlow);
const mockedUseConversation = jest.mocked(useConversation);

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

let onSend: (question: string) => void = jest.fn();
let onRetry: () => void = jest.fn();

const conversationValue = (overrides: Partial<ReturnType<typeof useConversation>> = {}) => {
  const defaults: ReturnType<typeof useConversation> = {
    messages: [],
    status: 'ready',
    lastError: null,
    errorKind: null,
    remainingCapacity: 8,
    quota: null,
    send: jest.fn(async (question: string) => onSend(question)),
    retry: jest.fn(async () => onRetry()),
    reload: jest.fn(async () => undefined),
  };
  return { ...defaults, ...overrides };
};

onSend = jest.fn();
onRetry = jest.fn();

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
    mockedUseConversation.mockReturnValue(conversationValue());
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

  it('renders exactly one labeled back control and no native route text', async () => {
    mockedUseScanFlow.mockReturnValue(contextValue(lowResult));
    const { getByLabelText, queryByText } = await renderScreen();
    expect(getByLabelText('Go back')).toBeTruthy();
    expect(queryByText('analysis/[id]')).toBeNull();
    expect(queryByText(/analysis\/\[/)).toBeNull();
  });

  it('shows Ask LifeLens entry with suggestion chips that submit the question', async () => {
    mockedUseScanFlow.mockReturnValue(contextValue(lowResult));
    mockedUseConversation.mockReturnValue(conversationValue());
    const { getByLabelText, getByText } = await renderScreen();
    expect(getByText('Ask about what you see')).toBeTruthy();
    fireEvent.press(getByLabelText(/Ask: What is this made of?/i));
    expect(onSend).toHaveBeenCalledWith('What is this made of?');
  });

  it('renders the conversation thread in order instead of the entry card', async () => {
    mockedUseScanFlow.mockReturnValue(contextValue(lowResult));
    const messages: ChatMessage[] = [
      { id: 'm1', role: 'user', content: 'First question', created_at: '2026-01-01T00:00:00Z' },
      {
        id: 'm2',
        role: 'assistant',
        content: 'First answer',
        created_at: '2026-01-01T00:00:01Z',
      },
      { id: 'm3', role: 'user', content: 'Second question', created_at: '2026-01-01T00:00:02Z' },
      {
        id: 'm4',
        role: 'assistant',
        content: 'Second answer',
        created_at: '2026-01-01T00:00:03Z',
      },
    ];
    mockedUseConversation.mockReturnValue(
      conversationValue({ messages, status: 'ready', remainingCapacity: 6 }),
    );
    const { getByText, queryByText } = await renderScreen();
    expect(getByText('First question')).toBeTruthy();
    expect(getByText('First answer')).toBeTruthy();
    expect(getByText('Second question')).toBeTruthy();
    expect(getByText('Second answer')).toBeTruthy();
    expect(queryByText('Ask about what you see')).toBeNull();
  });

  it('shows an inline retry when a follow-up fails and re-sends on tap', async () => {
    mockedUseScanFlow.mockReturnValue(contextValue(lowResult));
    mockedUseConversation.mockReturnValue(
      conversationValue({
        status: 'error',
        errorKind: 'send',
        lastError: {
          category: 'analysis_failed',
          code: 'ANALYSIS_FAILED',
          message: 'The answer could not be generated. Please try again.',
          details: null,
          retryable: true,
          status: 500,
        },
        messages: [],
      }),
    );
    const { getByText, getByLabelText } = await renderScreen();
    expect(getByText(/The answer could not be generated/i)).toBeTruthy();
    fireEvent.press(getByLabelText('Try again'));
    expect(onRetry).toHaveBeenCalled();
  });

  it('composer submits the typed question to the conversation', async () => {
    mockedUseScanFlow.mockReturnValue(contextValue(lowResult));
    const { getByLabelText, getByPlaceholderText } = await renderScreen();
    await fireEvent.changeText(getByPlaceholderText('Ask about what you just scanned…'), 'Tell me more');
    await fireEvent.press(getByLabelText('Send question'));
    expect(onSend).toHaveBeenCalledWith('Tell me more');
  });

  it('hides the composer when no analysis id is available', async () => {
    mockedUseScanFlow.mockReturnValue(
      contextValue({ ...lowResult, analysis: { ...baseAnalysis, id: null } }),
    );
    const { queryByLabelText } = await renderScreen();
    expect(queryByLabelText('Send question')).toBeNull();
  });
});