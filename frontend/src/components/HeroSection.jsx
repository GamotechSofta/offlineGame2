import React from 'react';

const HeroSection = () => {
  return (
    <section className="w-full bg-black">
      {/* Desktop Banner */}
      <div className="hidden md:block">
        <div className="overflow-hidden leading-[0]">
          <img
            src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1770635561/Black_Gold_Modern_Casino_Night_Party_Facebook_Cover_1545_x_900_px_1920_x_500_px_1_l8iyri.png"
            alt="Black Gold Casino Night Banner"
            className="block w-full h-auto object-contain"
            style={{ aspectRatio: '1920 / 500' }}
            loading="eager"
            draggable="false"
          />
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
