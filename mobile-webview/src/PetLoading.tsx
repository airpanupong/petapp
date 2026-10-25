import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const PETS = require('./assets/pet-sprites.png');
const LOGO = require('./assets/pet-logo.png');
// Sample a continuous spiral so position and velocity never kink at waypoints.
const STEPS = Array.from({ length: 61 }, (_, index) => index / 60);
const orbitX = STEPS.map(t => -Math.cos(t * Math.PI * 1.5) * 48 * (1 - t) ** 2);
const orbitY = STEPS.map(t => -Math.sin(t * Math.PI * 1.5) * 72 * (1 - t) ** 2);

/** Shared motion for app launch and subsequent WebView loads. */
export function PetLoading({
  compact = false,
  onIntroEnd,
}: {
  compact?: boolean;
  onIntroEnd?: () => void;
}) {
  const motion = useRef(new Animated.Value(0)).current;
  const breath = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const onIntroEndRef = useRef(onIntroEnd);
  onIntroEndRef.current = onIntroEnd;

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(value => {
        if (alive) setReduceMotion(value);
      })
      .catch(() => {
        if (alive) setReduceMotion(true);
      });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion === null) return;
    breath.setValue(0);
    shimmer.setValue(0);
    const shimmerLoop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1800,
        easing: Easing.linear,
        useNativeDriver: true,
        isInteraction: false,
      }),
    );
    if (reduceMotion) {
      motion.setValue(1);
      onIntroEndRef.current?.();
      return;
    }
    motion.setValue(0);
    const timing = (value: Animated.Value, toValue: number, duration: number) =>
      Animated.timing(value, {
        toValue,
        duration,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
        isInteraction: false,
      });
    // Assemble once, then breathe gently. Never pull the completed logo apart.
    const breathLoop = Animated.loop(
      Animated.sequence([timing(breath, 1, 1600), timing(breath, 0, 1600)]),
    );
    const assemble = timing(motion, 1, 1800);
    assemble.start(({ finished }) => {
      if (!finished) return;
      onIntroEndRef.current?.();
      breathLoop.start();
    });
    shimmerLoop.start();
    return () => {
      assemble.stop();
      breathLoop.stop();
      shimmerLoop.stop();
    };
  }, [motion, breath, shimmer, reduceMotion]);

  const petsOpacity = motion.interpolate({
    inputRange: [0, 0.7, 0.98, 1],
    outputRange: [1, 1, 0, 0],
  });
  const logoOpacity = motion.interpolate({
    inputRange: [0, 0.7, 0.98, 1],
    outputRange: [0, 0, 1, 1],
  });
  const reveal = motion.interpolate({
    inputRange: [0, 0.16, 1],
    outputRange: [0, 1, 1],
  });
  const titleReveal = motion.interpolate({
    inputRange: [0, 0.25, 0.85, 1],
    outputRange: [0, 0, 1, 1],
  });
  const petTransform = (direction: number) => [
    {
      translateX: motion.interpolate({
        inputRange: STEPS,
        outputRange: orbitX.map(x => x * direction),
      }),
    },
    {
      translateY: motion.interpolate({
        inputRange: STEPS,
        outputRange: orbitY.map(y => y * direction),
      }),
    },
    {
      rotate: motion.interpolate({
        inputRange: [0, 1],
        outputRange: [`${-24 * direction}deg`, '0deg'],
      }),
    },
    {
      scale: motion.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }),
    },
  ];
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="กำลังโหลด Pet haii"
      accessibilityState={{ busy: true }}
      style={styles.content}
    >
      <View style={compact ? styles.compactFrame : styles.frame}>
        <Animated.View
          style={[
            styles.stage,
            compact && styles.compactStage,
            { opacity: reveal },
          ]}
        >
          <Animated.View
            style={[
              styles.artwork,
              {
                transform: [
                  {
                    scale: breath.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.025],
                    }),
                  },
                  {
                    translateY: breath.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -3],
                    }),
                  },
                ],
              },
            ]}
          >
            <Animated.View
              style={[
                styles.halo,
                {
                  opacity: breath.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.65, 0.95],
                  }),
                  transform: [
                    {
                      scale: breath.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.06],
                      }),
                    },
                  ],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.dog,
                {
                  opacity: petsOpacity,
                  transform: petTransform(1),
                },
              ]}
            >
              <Image source={PETS} style={styles.dogSprite} />
            </Animated.View>
            <Animated.View
              style={[
                styles.cat,
                {
                  opacity: petsOpacity,
                  transform: petTransform(-1),
                },
              ]}
            >
              <Image source={PETS} style={styles.catSprite} />
            </Animated.View>
            <Animated.Image
              source={LOGO}
              resizeMode="contain"
              style={[styles.logo, { opacity: logoOpacity }]}
            />
          </Animated.View>
        </Animated.View>
      </View>
      {!compact && (
        <Animated.View
          style={{
            opacity: titleReveal,
            transform: [
              {
                translateY: motion.interpolate({
                  inputRange: [0, 1],
                  outputRange: [8, 0],
                }),
              },
            ],
          }}
        >
          <Text style={styles.title}>Pet haii</Text>
          <Text style={styles.subtitle}>พาน้องกลับบ้าน</Text>
        </Animated.View>
      )}
      <View style={styles.dots}>
        {[0, 1, 2].map(index => (
          <Animated.View
            key={index}
            style={[
              styles.dot,
              {
                opacity: shimmer.interpolate({
                  inputRange: STEPS,
                  outputRange: STEPS.map(t =>
                    reduceMotion
                      ? 0.5
                      : 0.3 +
                        0.7 *
                          (0.5 + 0.5 * Math.sin(2 * Math.PI * (t - index / 3))),
                  ),
                }),
                transform: [
                  {
                    translateY: shimmer.interpolate({
                      inputRange: STEPS,
                      outputRange: STEPS.map(t =>
                        reduceMotion
                          ? 0
                          : -2 *
                            (0.5 +
                              0.5 * Math.sin(2 * Math.PI * (t - index / 3))),
                      ),
                    }),
                  },
                ],
              },
            ]}
          />
        ))}
      </View>
      {!compact && <Text style={styles.caption}>กำลังเตรียมบ้านให้น้อง…</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center' },
  frame: {
    width: 260,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactFrame: {
    width: 80,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stage: { width: 220, height: 220 },
  artwork: { width: 220, height: 220 },
  compactStage: { transform: [{ scale: 0.32 }] },
  halo: {
    position: 'absolute',
    left: 10,
    top: 10,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#f8e4e4',
  },
  dog: {
    position: 'absolute',
    left: 4,
    top: 48,
    width: 140,
    height: 110,
    overflow: 'hidden',
  },
  cat: {
    position: 'absolute',
    left: 103,
    top: 73,
    width: 112,
    height: 110,
    overflow: 'hidden',
  },
  dogSprite: {
    position: 'absolute',
    width: 260,
    height: 260,
    left: 0,
    top: -96,
  },
  catSprite: {
    position: 'absolute',
    width: 260,
    height: 260,
    left: -148,
    top: -96,
  },
  logo: { position: 'absolute', width: 300, height: 300, left: -40, top: -47 },
  title: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.8,
    color: '#79516a',
  },
  subtitle: {
    textAlign: 'center',
    marginTop: 6,
    fontSize: 15,
    color: '#997b85',
  },
  dots: { flexDirection: 'row', gap: 8, marginTop: 24 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#b77e94' },
  caption: { marginTop: 12, fontSize: 12, color: '#a08a8d' },
});
