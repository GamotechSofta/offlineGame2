import React from 'react';

const AppLayout = ({ children }) => {
  return (
    <div className="w-screen h-screen bg-[#111] text-white overflow-hidden">
      <div className="w-full h-full overflow-hidden">
        {children}
      </div>
    </div>
  );
};

export default AppLayout;
