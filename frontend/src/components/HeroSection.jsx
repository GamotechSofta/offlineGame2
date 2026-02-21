import React from 'react';

const heroImageUrl =
  'https://res.cloudinary.com/dnyp5jknp/image/upload/v1770722975/Black_Gold_Modern_Casino_Night_Party_Facebook_Cover_1545_x_900_px_1920_x_500_px_1_l8iyri_rnwjad.png';

const HeroSection = () => {
  return (
    <section
      className="w-full max-w-full overflow-hidden mb-6 mt-5"
      style={{
        aspectRatio: '1920 / 500',
        backgroundImage: `url(${heroImageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'top center',
        backgroundRepeat: 'no-repeat',
      }}
    />
  );
};

export default HeroSection;
