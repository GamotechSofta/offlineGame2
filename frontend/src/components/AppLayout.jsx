import React from 'react';

const AppLayout = ({ children }) => {
  return (
    <div className="h-screen bg-[#070707] text-white overflow-hidden">
      <div className="w-full h-full border border-[#4c4c4c] bg-[#111]">
        {children}
      </div>
    </div>
  );
};

export default AppLayout;
