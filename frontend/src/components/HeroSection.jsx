import React from 'react';

const heroImageDesktop =
  'https://res.cloudinary.com/dzd47mpdo/image/upload/v1770635561/Black_Gold_Modern_Casino_Night_Party_Facebook_Cover_1545_x_900_px_1920_x_500_px_1_l8iyri.png';
const heroImageMobile =
  'https://res.cloudinary.com/dzd47mpdo/image/upload/v1770623700/Black_Gold_Modern_Casino_Night_Party_Facebook_Cover_1545_x_900_px_ufrc1r.png';

const heroStyle = (url) => ({
  backgroundImage: `url(${url})`,
  backgroundSize: 'cover',
  backgroundPosition: 'top center',
  backgroundRepeat: 'no-repeat',
});

const HeroSection = () => {
  return (
    <>
      {/* Desktop: section with aspect ratio so the background has height */}
      <section
        className="w-full max-w-full overflow-hidden mb-6 relative hidden md:block"
        style={{ aspectRatio: '1920/500' }}
      >
        <div
          className="absolute inset-0 w-full h-full"
          style={heroStyle(heroImageDesktop)}
        />
      </section>
      {/* Mobile: img at original aspect ratio */}
      <section className="w-full max-w-full overflow-hidden mb-6 md:hidden">
        <img
          src={heroImageMobile}
          alt=""
          className="w-full h-auto object-contain"
        />
      </section>
    </>
  );
};

export default HeroSection;
