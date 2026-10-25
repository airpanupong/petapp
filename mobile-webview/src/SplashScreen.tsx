import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { PetLoading } from './PetLoading';

export function SplashScreen({
  visible,
  onIntroEnd,
}: {
  visible: boolean;
  onIntroEnd?: () => void;
}) {
  const [mounted, setMounted] = useState(visible);
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  useEffect(() => {
    if (visible) {
      setMounted(true);
      opacity.setValue(1);
      return;
    }
    const exit = Animated.timing(opacity, {
      toValue: 0,
      duration: 280,
      useNativeDriver: true,
    });
    exit.start(({ finished }) => {
      if (finished) setMounted(false);
    });
    return () => exit.stop();
  }, [visible, opacity]);
  if (!mounted) return null;
  return (
    <Animated.View
      testID="splash-screen"
      style={[styles.root, { opacity }]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <PetLoading onIntroEnd={onIntroEnd} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff5f2',
  },
});
