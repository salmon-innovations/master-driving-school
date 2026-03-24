const fs = require('fs');
const path = 'C:/Users/gabas/OneDrive/Desktop/Booking System/booking-system-frontend/src/pages/Home.jsx';
let content = fs.readFileSync(path, 'utf8');

// 1. imports
content = content.replace(
  "import { newsAPI } from '../services/api'",
  "import { newsAPI, testimonialsAPI } from '../services/api'"
);

// 2. State
content = content.replace(
  "const [selectedVideo, setSelectedVideo] = useState(null)",
  "const [selectedVideo, setSelectedVideo] = useState(null)\n  const [testimonials, setTestimonials] = useState([])\n  const [selectedReviewMedia, setSelectedReviewMedia] = useState(null)"
);

// 3. fetch in useEffect
let effectStr = `
    const fetchTestimonials = async () => {
      try {
        const response = await testimonialsAPI.getAll();
        if (response.success) {
          setTestimonials(response.testimonials || []);
        }
      } catch (error) {
        console.error('Failed to fetch testimonials:', error);
      }
    };
    fetchTestimonials();
`;
content = content.replace("const fetchVideos = async () => {", fetchTestimonialsStr => effectStr + "\n    " + fetchTestimonialsStr);


// 4. Removing hardcoded dummy testimonials block completely
let dummyStart = content.indexOf("  const testimonials = [");
let dummyEnd = content.indexOf("  const stats = [");
if(dummyStart !== -1 && dummyEnd !== -1) {
    let getMediaUrlBlock = `
  const getMediaUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const MEDIA_BASE_URL = API_URL.replace('/api', '');
    return \`\${MEDIA_BASE_URL}\${url.startsWith('/') ? '' : '/'}\${url}\`;
  };

`;
    content = content.substring(0, dummyStart) + getMediaUrlBlock + content.substring(dummyEnd);
}

// 5. Build Thumbnail UI
const thumbnailFix = `                  <div className="mb-5 w-full rounded-xl overflow-hidden border border-white/15 shadow-sm shrink-0 bg-black/20 aspect-video flex items-center justify-center relative group">
                    {testimonial.videoUrl ? (
                      <>
                        <video
                          className="w-full h-full object-cover block cursor-pointer"
                          preload="metadata"
                          onClick={() => setSelectedReviewMedia({ type: 'video', url: getMediaUrl(testimonial.videoUrl) })}
                        >
                          <source src={getMediaUrl(testimonial.videoUrl)} type="video/mp4" />
                          Your browser does not support the video tag.
                        </video>
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center group-hover:bg-black/70 transition-colors backdrop-blur-sm">
                            <span className="text-white text-xl ml-1">▶</span>
                          </div>
                        </div>
                      </>
                    ) : testimonial.imageUrl ? (
                      <div className="relative w-full h-full cursor-pointer group" onClick={() => setSelectedReviewMedia({ type: 'image', url: getMediaUrl(testimonial.imageUrl) })}>
                        <img 
                          src={getMediaUrl(testimonial.imageUrl)} 
                          alt="Student Review" 
                          className="w-full h-full object-cover block transition-transform duration-300 group-hover:scale-105" 
                        />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                          <svg className="w-10 h-10 text-white drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-white/5">
                        <div className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center text-xl mb-2">▶</div>
                        <p className="text-xs text-white/80 font-medium">No media provided</p>
                      </div>
                    )}
                  </div>
`;

let mapStart = content.indexOf('{testimonials.slice(0, 5).map((testimonial, index) => (');
if(mapStart !== -1) {
   let innerStart = content.indexOf('<div className="flex mb-3">', mapStart);
   if (innerStart !== -1) {
      content = content.substring(0, innerStart) + thumbnailFix + content.substring(innerStart);
   }
}

// 6. See all Button
content = content.replace(
  '            ))}\r\n          </div>\r\n        </div>\r\n      </section>',
  \`            ))}\n          </div>\n          <div className="flex justify-center mt-8">\n            <button onClick={() => { onNavigate('reviews'); window.scrollTo(0, 0); }} className="px-6 py-3 bg-white text-[#2157da] border border-[#2157da] font-semibold rounded-lg hover:bg-gray-50 transition-colors shadow-sm">See All Reviews</button>\n          </div>\n        </div>\n      </section>\`
);
content = content.replace(
  '            ))}\n          </div>\n        </div>\n      </section>',
  \`            ))}\n          </div>\n          <div className="flex justify-center mt-8">\n            <button onClick={() => { onNavigate('reviews'); window.scrollTo(0, 0); }} className="px-6 py-3 bg-white text-[#2157da] border border-[#2157da] font-semibold rounded-lg hover:bg-gray-50 transition-colors shadow-sm">See All Reviews</button>\n          </div>\n        </div>\n      </section>\`
);

// 7. Modals
const modalsHtml = \`      {/* Review Media Modal */}
      {selectedReviewMedia && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm" onClick={() => setSelectedReviewMedia(null)}>
          <button className="absolute top-4 right-4 sm:top-6 sm:right-6 bg-white text-black rounded-full p-2 hover:bg-gray-200 z-[110] transition-colors" onClick={() => setSelectedReviewMedia(null)}>
            <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <div className="relative flex items-center justify-center max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
            {selectedReviewMedia.type === 'video' ? (
              <video className="max-w-[95vw] max-h-[90vh] object-contain outline-none rounded shadow-2xl bg-black" src={selectedReviewMedia.url} controls autoPlay playsInline />
            ) : (
              <img src={selectedReviewMedia.url} alt="Review Full View" className="max-w-[95vw] max-h-[90vh] object-contain rounded shadow-2xl" />
            )}
          </div>
        </div>
      )}\`;

let endDiv = content.lastIndexOf('</div>');
if(endDiv !== -1) {
    content = content.substring(0, endDiv) + modalsHtml + '\\n' + content.substring(endDiv);
}

fs.writeFileSync(path, content);
console.log('Fixed Home Data Fetching vs Dummy Data!');
