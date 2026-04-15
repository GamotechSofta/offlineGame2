import React from 'react';

const AppLayout = ({ children }) => {
  return (
    <div className="w-full min-h-screen min-h-[100dvh] bg-[#111] text-white overflow-x-hidden">
      <div className="w-full min-h-screen min-h-[100dvh] overflow-x-hidden">
        {children}
      </div>
    </div>
  );
};

export default AppLayout;
