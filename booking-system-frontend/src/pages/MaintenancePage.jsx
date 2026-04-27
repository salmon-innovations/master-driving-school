import React from 'react';

const MaintenancePage = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-3xl shadow-xl p-8 md:p-12 text-center border border-gray-100">
        <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-12 h-12 text-[#2157da]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h1 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">System Maintenance</h1>
        <p className="text-gray-600 mb-8 text-lg leading-relaxed">
          We're currently updating the Master Driving School booking portal to bring you a better experience. We'll be back online shortly.
        </p>
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 bg-gray-100 px-4 py-2 rounded-full">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-[#2157da]"></span>
          </span>
          Working on updates...
        </div>
      </div>
      <div className="mt-8 text-sm text-gray-400 font-medium">
        &copy; {new Date().getFullYear()} Master Driving School PH
      </div>
    </div>
  );
};

export default MaintenancePage;
