import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FollowUpComposer } from '@/features/scan/presentation/follow-up-composer';

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
        frame: { x: 0, y: 0, width: 390, height: 844 },
      }}>
      {ui}
    </SafeAreaProvider>,
  );
}

describe('FollowUpComposer', () => {
  it('submits the typed question and clears the input', async () => {
    const onSubmit = jest.fn();
    const { getByLabelText, getByPlaceholderText } = await renderWithProviders(
      <FollowUpComposer onSubmit={onSubmit} />,
    );
    await fireEvent.changeText(getByPlaceholderText('Ask about what you just scanned…'), '  Tell me more  ');
    await fireEvent.press(getByLabelText('Send question'));
    expect(onSubmit).toHaveBeenCalledWith('Tell me more');
    expect(getByPlaceholderText('Ask about what you just scanned…').props.value).toBe('');
  });

  it('does not submit blank input', async () => {
    const onSubmit = jest.fn();
    const { getByPlaceholderText } = await renderWithProviders(<FollowUpComposer onSubmit={onSubmit} />);
    await fireEvent.changeText(getByPlaceholderText('Ask about what you just scanned…'), '   ');
    await fireEvent(getByPlaceholderText('Ask about what you just scanned…'), 'submitEditing');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('disables input while sending', async () => {
    const onSubmit = jest.fn();
    const { getByLabelText, getByPlaceholderText } = await renderWithProviders(
      <FollowUpComposer onSubmit={onSubmit} sending />,
    );
    expect(getByPlaceholderText('Ask about what you just scanned…').props.editable).toBe(false);
    await fireEvent.changeText(getByPlaceholderText('Ask about what you just scanned…'), 'hello');
    await fireEvent.press(getByLabelText('Send question'));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});