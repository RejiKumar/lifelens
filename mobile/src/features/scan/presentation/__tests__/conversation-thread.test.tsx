import { render } from '@testing-library/react-native';

import type { ChatMessage } from '@/features/scan/domain/types';

const mockUseReducedMotion = jest.fn(() => false);

jest.mock('@/features/scan/presentation/use-reduced-motion', () => ({
  useReducedMotion: () => mockUseReducedMotion(),
}));

import { ConversationThread } from '@/features/scan/presentation/conversation-thread';

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

describe('ConversationThread', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseReducedMotion.mockImplementation(() => false);
  });

  it('renders messages in chronological order', async () => {
    const { getByLabelText } = await render(<ConversationThread messages={messages} />);
    expect(getByLabelText(/You asked: First question/i)).toBeTruthy();
    expect(getByLabelText(/LifeLens answered: First answer/i)).toBeTruthy();
    expect(getByLabelText(/You asked: Second question/i)).toBeTruthy();
    expect(getByLabelText(/LifeLens answered: Second answer/i)).toBeTruthy();
  });

  it('honors reduced motion and still renders every message', async () => {
    mockUseReducedMotion.mockImplementation(() => true);
    const { getByLabelText } = await render(<ConversationThread messages={messages} />);
    expect(getByLabelText(/You asked: First question/i)).toBeTruthy();
    expect(getByLabelText(/LifeLens answered: Second answer/i)).toBeTruthy();
  });
});