import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

const HERO_IMAGE =
  'https://res.cloudinary.com/dzd47mpdo/image/upload/v1770623700/Black_Gold_Modern_Casino_Night_Party_Facebook_Cover_1545_x_900_px_ufrc1r.png';

export default function HeroSection() {
  return (
    <View style={styles.section}>
      <Image source={{ uri: HERO_IMAGE }} style={styles.image} resizeMode="cover" />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { width: '100%', marginBottom: 24, overflow: 'hidden' },
  image: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#f3f4f6' },
});
