const fs = require('fs');
let c = fs.readFileSync('src/App.jsx', 'utf8');

const navLogic = `  const handleNavigation = (page) => {
    setCurrentPage(page);
    window.history.pushState(null, '', \`/\${page === 'home' ? '' : page}\`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.substring(1);
      const validPages = ['home', 'courses', 'about', 'contact', 'branches', 'news', 'terms', 'privacy', 'conditions', 'signin', 'signup', 'guest-enrollment', 'verify-email', 'forgot-password', 'lock-account', 'profile', 'reviews', 'payment', 'schedule', 'admin', 'staff-dashboard'];
      if (path === '' || path === 'home') {
        setCurrentPage('home');
      } else if (validPages.includes(path)) {
        setCurrentPage(path);
      } else {
        setCurrentPage('home');
      }
    };
    window.addEventListener('popstate', handlePopState);
    if (window.location.pathname === '/' || window.location.pathname === '/home') {
      window.history.replaceState(null, '', window.location.pathname === '/home' ? '/home' : '/');
    }
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleLogout = async`;

c = c.replace(/const handleLogout = async/g, navLogic);
c = c.replace(/setCurrentPage\('home'\)/g, "handleNavigation('home')");
c = c.replace(/onNavigate={setCurrentPage}/g, "onNavigate={handleNavigation}");
c = c.replace(/setCurrentPage={setCurrentPage}/g, "setCurrentPage={handleNavigation}");

const mainTagStart = `<main className={\`\${!isAuthPage ? 'flex-grow pt-[84px] sm:pt-[108px] md:pt-[124px]' : 'flex-grow'}\`}>`;
if(c.includes(mainTagStart)) {
  c = c.replace(
    /<main className=\{`\$\{\!isAuthPage \? 'flex-grow pt-\[84px\] sm:pt-\[108px\] md:pt-\[124px\]' : 'flex-grow'\}`\}>\s*\{renderPage\(\)\}\s*<\/main>/,
    `<main className={\`\${!isAuthPage ? 'flex-grow pt-[84px] sm:pt-[108px] md:pt-[124px]' : 'flex-grow'}\`}>
            <Suspense fallback={
              <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            }>
              {renderPage()}
            </Suspense>
          </main>`
  );
} else {
  console.log("Could not find main tag exactly.");
}

fs.writeFileSync('src/App.jsx', c);
console.log("Patched App.jsx successfully!");
