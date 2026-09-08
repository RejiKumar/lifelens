import { render, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import CameraScreen from '@/app/camera';
import { useCameraPermissions } from 'expo-camera';
import { useScanFlow } from '@/features/scan/presentation/scan-context';
import { analytics } from '@/features/scan/analytics';

const mockedUseCameraPermissions = useCameraPermissions as jest.Mock;
const mockedUseScanFlow = useScanFlow as jest.Mock;

jest.mock('expo-camera', () => ({
  CameraView: () => null,
  useCameraPermissions: jest.fn(),
  FlashMode: { off: 'off', on: 'on', auto: 'auto' },
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    dismiss: jest.fn(),
    push: jest.fn(),
  }),
}));

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

jest.mock('@/features/scan/analytics', () => ({
  analytics: {
    scanStart: jest.fn(),
    photoCaptured: jest.fn(),
    photoPicked: jest.fn(),
    cameraPermissionDenied: jest.fn(),
  },
}));

jest.mock('@/features/scan/presentation/scan-context', () => ({
  useScanFlow: jest.fn(),
}));

describe('CameraScreen permission denial', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseScanFlow.mockReturnValue({
      prepareImage: jest.fn(),
    });
  });

  const renderScreen = () =>
    render(
      <SafeAreaProvider
        initialMetrics={{
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
          frame: { x: 0, y: 0, width: 390, height: 844 },
        }}>
        <CameraScreen />
      </SafeAreaProvider>,
    );

  it('renders the permission request message when denied', async () => {
    mockedUseCameraPermissions.mockReturnValue([
      { granted: false, canAskAgain: true },
      jest.fn(),
    ]);

    const { getByText } = await renderScreen();
    expect(getByText(/Camera permission is required/i)).toBeTruthy();
    expect(getByText('Grant Permission')).toBeTruthy();
    expect(getByText('Go Back')).toBeTruthy();
  });

  it('requests permission when the grant button is pressed', async () => {
    const requestPermission = jest.fn();
    mockedUseCameraPermissions.mockReturnValue([
      { granted: false, canAskAgain: true },
      requestPermission,
    ]);

    const { getByText } = await renderScreen();
    fireEvent.press(getByText('Grant Permission'));
    expect(requestPermission).toHaveBeenCalled();
  });

  it('does not render the capture UI when permission is denied', async () => {
    mockedUseCameraPermissions.mockReturnValue([
      { granted: false, canAskAgain: true },
      jest.fn(),
    ]);

    const { queryByText } = await renderScreen();
    expect(queryByText(/Center the object in the frame/i)).toBeNull();
    expect(queryByText('Take photo')).toBeNull();
  });
});