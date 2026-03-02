import React from 'react';
import { BACKEND_BASE_URL } from '../config/api';

const APK_URL = `${BACKEND_BASE_URL}/downloads/myapp.apk`;

const Download = () => {
  return (
    <div className="min-h-screen bg-gray-50 p-8 flex flex-col items-center justify-center">
      <h1 className="text-3xl font-bold text-gray-800">Download App</h1>
      <p className="mt-4 text-gray-600 text-center">Download the RATAN 365 mobile app for Android</p>
      <a
        href={APK_URL}
        download="myapp.apk"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-8 inline-flex items-center gap-2 bg-[#1B3150] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#152842] transition-colors shadow-lg"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Download APK
      </a>
    </div>
  );
};

export default Download;
