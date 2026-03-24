const fs = require('fs');

const path = 'C:\\Users\\gabas\\OneDrive\\Desktop\\Booking System\\booking-system-frontend\\src\\pages\\Home.jsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add getMediaUrl function
const baseMediaScript = `
  const getMediaUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const MEDIA_BASE_URL = API_URL.replace('/api', '');
    return \`\${MEDIA_BASE_URL}\${url.startsWith('/') ? '' : '/'}\${url}\`;
  };
`;

if (!content.includes('getMediaUrl')) {
  content = content.replace('const handleNavigate = (path) => {', baseMediaScript + '\n  const handleNavigate = (path) => {');
}

// 2. Limit to 5 testimonials
content = content.replace('{testimonials.map((testimonial, index) => (', '{testimonials.slice(0, 5).map((testimonial, index) => (');

// 3. Fix Media Block to show Image/Video correctly mapped with getMediaUrl
let originalMediaBlock = `                  <div className="mb-5 w-full rounded-xl overflow-hidden border border-white/15 shadow-sm shrink-0 bg-black/20 aspect-video flex items-center justify-center">
                  {testimonial.videoUrl ? (
                    <video
                      controls
                      className="w-full h-full object-cover block"
                      preload="metadata"
                    >
                      <source src={testimonial.videoUrl} type="video/mp4" />
                      Your browser does not support the video tag.
                    </video>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-white/5">
                      <div className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center text-xl mb-2">▶</div>
                      <p className="text-xs text-white/80 font-medium">No video testimonial yet</p>
                    </div>
                  )}
                </div>`;

let replacementMediaBlock = `                  <div className="mb-5 w-full rounded-xl overflow-hidden border border-white/15 shadow-sm shrink-0 bg-black/20 aspect-video flex items-center justify-center">
                  {testimonial.videoUrl ? (
                    <video
                      controls
                      className="w-full h-full object-cover block"
                      preload="metadata"
                    >
                      <source src={getMediaUrl(testimonial.videoUrl)} type="video/mp4" />
                      Your browser does not support the video tag.
                    </video>
                  ) : testimonial.imageUrl ? (
                    <img 
                      src={getMediaUrl(testimonial.imageUrl)} 
                      alt="Student Review" 
                      className="w-full h-full object-cover block" 
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-white/5">
                      <div className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center text-xl mb-2">▶</div>
                      <p className="text-xs text-white/80 font-medium">No media provided</p>
                    </div>
                  )}
                </div>`;

content = content.replace(originalMediaBlock, replacementMediaBlock);

// 4. Add "See All Reviews" button
let originalSeeAllBlock = `          <div className="text-center mt-12">
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Did you recently complete a course with us?</h3>`;

let replacementSeeAllBlock = `          <div className="text-center mt-8 mb-8">
            <button
              onClick={() => handleNavigate('reviews')}
              className="px-8 py-3 bg-white text-[#2157da] border-2 border-[#2157da] font-bold text-base rounded-full hover:bg-gray-50 transition-all shadow-md hover:shadow-lg focus:outline-none"
            >
              See All Reviews
            </button>
          </div>
          <div className="text-center mt-12">
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Did you recently complete a course with us?</h3>`;

content = content.replace(originalSeeAllBlock, replacementSeeAllBlock);

fs.writeFileSync(path, content);
console.log('Modified Home.jsx successfully');
