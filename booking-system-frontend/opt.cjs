const fs = require('fs');

let code = fs.readFileSync('src/App.jsx', 'utf8');

// 1. Optimize bundle size using lazy loading array
const pages = [
  'Home', 'Courses', 'About', 'Contact', 'Branches', 'NewsAndEvents',
  'TermsOfUse', 'PrivacyPolicy', 'TermsAndConditions', 'SignIn', 'SignUp',
  'GuestEnrollment', 'VerifyEmail', 'ForgotPassword', 'LockAccount',
  'Profile', 'Payment', 'Schedule', 'Reviews'
];

code = code.replace("import { useState, useEffect } from 'react'", "import React, { useState, useEffect, Suspense, lazy } from 'react'");

pages.forEach(p => {
  code = code.replace(new RegExp(`import ${p} from '\\.\\/pages\\/${p}'`), `const ${p} = lazy(() => import('./pages/${p}'))`);
});

code = code.replace(/import Admin from '\.\/admin\/Admin'/, `const Admin = lazy(() => import('./admin/Admin'))`);
code = code.replace(/import StaffDashboard from '\.\/admin\/staff\/StaffDashboard'/, `const StaffDashboard = lazy(() => import('./admin/staff/StaffDashboard'))`);

// 2. Add suspense wrapper
code = code.replace(/<div className="flex-grow pt-16 sm:pt-20">([\s\S]*?)<\/div>/, 
`<div className="flex-grow pt-16 sm:pt-20">
            <Suspense fallback={<div className="flex-grow flex items-center justify-center min-h-[50vh]"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-900"></div></div>}>
              {renderPage()}
            </Suspense>
          </div>`);
          
// 3. Fix URL Linking logic!

const stateLogic = `const [currentPage, setCurrentPage] = useState(() => {
    const path = window.location.pathname.substring(1);
    const validPages = ['home', 'courses', 'about', 'contact', 'branches', 'news', 'terms', 'privacy', 'conditions', 'signin', 'signup', 'guest-enrollment', 'verify-email', 'forgot-password', 'lock-account', 'profile', 'reviews', 'payment', 'schedule', 'admin', 'staff-dashboard'];
    if (validPages.includes(path)) {
      return path;
    }
    return localStorage.getItem('currentPage') || 'home';
  })`;

code = code.replace(/const \[currentPage, setCurrentPage\] = useState\(localStorage\.getItem\('currentPage'\) \|\| 'home'\)/, stateLogic);

const effectLogic = `// Sync state to storage and update URL
  useEffect(() => {
    localStorage.setItem('currentPage', currentPage)
    if (currentPage === 'home') {
      window.history.pushState(null, '', '/');
    } else {
      window.history.pushState(null, '', \`/\${currentPage}\`);
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [currentPage])

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.substring(1) || 'home';
      setCurrentPage(path);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);`;

code = code.replace(/([\s\S]*?)\/\/ Sync state to storage\n  useEffect\(\(\) => {\n    localStorage\.setItem\('currentPage', currentPage\)\n  }, \[currentPage\]\)([\s\S]*?)/, `$1\n\n  ${effectLogic}\n$2`);

fs.writeFileSync('src/App.jsx', code);