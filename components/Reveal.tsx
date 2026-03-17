import { type ReactNode, useEffect, useRef } from 'react'
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native'

type RevealProps = {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  delay?: number
  duration?: number
  distance?: number
  scaleFrom?: number
}

export default function Reveal({
  children,
  style,
  delay = 0,
  duration = 480,
  distance = 16,
  scaleFrom = 0.985,
}: RevealProps) {
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(distance)).current
  const scale = useRef(new Animated.Value(scaleFrom)).current

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ])

    animation.start()
    return () => animation.stop()
  }, [delay, distance, duration, opacity, scale, scaleFrom, translateY])

  return (
    <Animated.View
      style={[
        style,
        {
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
    >
      {children}
    </Animated.View>
  )
}
