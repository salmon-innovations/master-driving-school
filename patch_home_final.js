const fs = require('fs');

let fileStr = fs.readFileSync('C:/Users/gabas/OneDrive/Desktop/Booking System/booking-system-frontend/src/pages/Home.jsx', 'utf8');

// 1. Add testimonialsAPI to imports
fileStr = fileStr.replace(
  "import { newsAPI } from '../services/api'",
  "import { newsAPI, testimonialsAPI } from '../services/api'"
);

// 2. Add `const [testimonials, setTestimonials] = useState([])` and `const [selectedReviewMedia, setSelectedReviewMedia] = useState(null)`
fileStr = fileStr.replace(
  "const [selectedVideo, setSelectedVideo] = useState(null)",
  "const [selectedVideo, setSelectedVideo] = useState(null)\n  const [testimonials, setTestimonials] = useState([])\n  const [selectedReviewMedia, setSelectedReviewMedia] = useState(null)"
);

// 3. Remove the hardcoded testimonials array and add getMediaUrl
let staticTestiEnd = fileStr.indexOf('const stats = [');
if (staticTestiEnd !== -1) {
  let staticTestiStart = fileStr.indexOf('  const testimonials = [');
  if (staticTestiStart !== -1) {
    let newSection = `
  const getMediaUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const MEDIA_BASE_URL = API_URL.replace('/api', '');
    return \`\${MEDIA_BASE_URL}\${url.startsWith('/') ? '' : '/'}\${url}\`;
  };

`;
    fileStr = fileStr.substring(0, staticTestiStart) + newSection + fileStr.substring(staticTestiEnd);
  }
}

// 4. Inject fetching into useEffect
let effectStart = fileStr.indexOf('const fetchVideos = async () =>');
if (effectStart !== -1) {
  let fetchTestiStr = `
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
  fileStr = fileStr.substring(0, effectStart) + fetchTestiStr + fileStr.substring(effectStart);
}

// 5. Replace thumbnail HTML logic inside testimonials section
const newCardStr = `
              <div
                key={index}
                className="bg-gradient-to-br from-[#2157da] to-[#1a3a8a] p-6 sm:p-8 rounded-2xl shadow-lg text-white"
                data-aos="fade-up"
                data-aos-delay={index * 150}
              >
                  <div className="mb-5 w-full rounded-xl overflow-hidden border border-white/15 shadow-sm shrink-0 bg-black/20 aspect-video flex items-center justify-center relative group">
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
                    ) : null }
                  </div>

                <div className="flex mb-3">
`;

// Extract card bounds for replacement
let mapStart = fileStr.indexOf('{testimonials.slice(0, 5).map((testimonial, index) => (');
if (mapStart !== -1) {
  let innerCardStart = fileStr.indexOf('<div\n                key={index}', mapStart);
  if(innerCardStart === -1) innerCardStart = fileStr.indexOf('<div\r\n                key={index}', mapStart);
  
  if (innerCardStart !== -1) {
    let flexMb3Start = fileStr.indexOf('                <div className="flex mb-3">', innerCardStart);
    if (flexMb3Start !== -1) {
      fileStr = fileStr.substring(0, innerCardStart) + newCardStr + fileStr.substring(flexMb3Start + 43);
    }
  }
}

// 6. Embed the Modals at the bottom right before the last closing div.
const modalsHtml = `      {/* Review Media Modal */}
      {selectedReviewMedia && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
          onClick={() => setSelectedReviewMedia(null)}
        >
          <button
            className="absolute top-4 right-4 sm:top-6 sm:right-6 bg-white text-black rounded-full p-2 hover:bg-gray-200 z-[110] transition-colors"
            onClick={() => setSelectedReviewMedia(null)}
          >
            <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <div 
            className="relative flex items-center justify-center w-full max-w-[95vw] max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedReviewMedia.type === 'video' ? (
              <video
                className="max-w-[95vw] max-h-[90vh] object-contain outline-none rounded shadow-2xl bg-black"
                src={selectedReviewMedia.url}
                controls
                autoPlay
                playsInline
              />
            ) : (
              <img
                src={selectedReviewMedia.url}
                alt="Review Full View"
                className="max-w-[95vw] max-h-[90vh] object-contain rounded shadow-2xl"
              />
            )}
          </div>
        </div>
      )}

      {/* Full Screen Video Modal for Promotions */}
      {selectedVideo && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
          onClick={() => setSelectedVideo(null)}
        >
          <button
            className="absolute top-4 right-4 sm:top-6 sm:right-6 bg-white text-black rounded-full p-2 hover:bg-gray-200 z-[110] transition-colors"
            onClick={() => setSelectedVideo(null)}
          >
            <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <div 
            className="relative flex items-center justify-center w-full max-w-[95vw] max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedVideo.media_url && selectedVideo.media_url.startsWith('data:video') ? (
              <video
                className="max-w-full max-h-[90vh] object-contain outline-none rounded shadow-2xl bg-black"
                src={selectedVideo.media_url}
                title={selectedVideo.title}
                controls
                autoPlay
                playsInline
              />
            ) : (
              <iframe
                className="w-full max-w-5xl aspect-video rounded-xl shadow-2xl border-0"
                src={selectedVideo.media_url || "https://www.youtube.com/embed/dQw4w9WgXcQ"}
                title={selectedVideo.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
export default Home`;

let finalTagIndex = fileStr.lastIndexOf('</div>\n  )\n}\n\nexport default Home');
if (finalTagIndex === -1) finalTagIndex = fileStr.lastIndexOf('</div>\r\n  )\r\n}\r\n\r\nexport default Home');
if (finalTagIndex === -1) {
    // try to find the last div before export default
    let parts = fileStr.split('export default Home');
    if(parts.length > 1) {
        let beforeExport = parts[0];
        let lastDiv = beforeExport.lastIndexOf('</div>');
        if (lastDiv !== -1) {
            fileStr = beforeExport.substring(0, lastDiv) + modalsHtml;
        }
    }
} else {
    fileStr = fileStr.substring(0, finalTagIndex) + modalsHtml;
}

// 7. Add a "See All Reviews" button.
let seeAllStr = `
            ))}
          </div>
          <div className="flex justify-center mt-8">
            <button
              onClick={() => {
                onNavigate('reviews');
                window.scrollTo(0, 0);
              }}
              className="px-6 py-3 bg-white text-[#2157da] border border-[#2157da] font-semibold rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
            >
              See All Reviews
            </button>
          </div>
        </div>
      </section>
`;
fileStr = fileStr.replace(
  '            ))}\n          </div>\n        </div>\n      </section>',
  seeAllStr
);
// Handle CRLF string just in case
fileStr = fileStr.replace(
  '            ))}\r\n          </div>\r\n        </div>\r\n      </section>',
  seeAllStr
);


fs.writeFileSync('C:/Users/gabas/OneDrive/Desktop/Booking System/booking-system-frontend/src/pages/Home.jsx', fileStr);
console.log('Successfully completed Home.jsx patch.');
