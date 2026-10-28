jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: {
      View,
      createAnimatedComponent: (Component: unknown) => Component,
    },
    useSharedValue: (initial: unknown) => ({ value: initial }),
    useAnimatedStyle: () => ({}),
    useAnimatedProps: () => ({}),
    withTiming: (toValue: unknown) => toValue,
    withRepeat: (animation: unknown) => animation,
    withSequence: (...animations: unknown[]) => animations[0] ?? 0,
    withSpring: (toValue: unknown) => toValue,
    Easing: {
      linear: () => (value: unknown) => value,
      out: () => (value: unknown) => value,
      cubic: () => (value: unknown) => value,
    },
  };
});