import React, { useState, useRef, useEffect } from 'react';
import { View, Image, StyleSheet, Animated } from 'react-native';

// Compressed for faster load: w_600 (mobile), q_auto:eco, f_auto (WebP)
const HERO_IMAGE =
  'https://res.cloudinary.com/dzd47mpdo/image/upload/w_600,q_auto:eco,f_auto/v1770623700/Black_Gold_Modern_Casino_Night_Party_Facebook_Cover_1545_x_900_px_ufrc1r.png';

export default function HeroSection() {
  const [loaded, setLoaded] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (loaded) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }
  }, [loaded]);

  return (
    <View style={styles.section}>
      {!loaded && <View style={styles.placeholder} />}
      <Animated.View style={[styles.imageWrap, { opacity: loaded ? fadeAnim : 0 }]}>
        <Image
          source={{ uri: HERO_IMAGE }}
          style={styles.image}
          resizeMode="cover"
          onLoadEnd={() => setLoaded(true)}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { width: '100%', marginBottom: 24, overflow: 'hidden' },
  placeholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    aspectRatio: 16 / 9,
    backgroundColor: '#1B3150',
  },
  imageWrap: { width: '100%', aspectRatio: 16 / 9 },
  image: { width: '100%', height: '100%', backgroundColor: '#1B3150' },
});
