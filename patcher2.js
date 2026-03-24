const fs = require('fs');
let content = fs.readFileSync('C:/Users/gabas/OneDrive/Desktop/Booking System/booking-system-frontend/src/pages/Home.jsx', 'utf8');

const updatedTestimonialCard = `                  <div className="mb-5 w-full rounded-xl overflow-hidden border border-white/15 shadow-sm shrink-0 bg-black/20 aspect-video flex items-center justify-center relative group">
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
                  </div>`;

const reviewModal = `      {/* Review Media Modal */}
      {selectedReviewMedia && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-[2px]"
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
            className="relative flex items-center justify-center max-w-full max-h-full"
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
      )}`;

const fullScreenVideoModal = `      {/* Full Screen Video Modal */}
      {selectedVideo && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-[2px]"
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
      )}`;

// 1. Inject state
if(!content.includes('const [selectedReviewMedia')) {
  content = content.replace('const [selectedVideo, setSelectedVideo] = useState(null)', 'const [selectedVideo, setSelectedVideo] = useState(null)\n  const [selectedReviewMedia, setSelectedReviewMedia] = useState(null)');
}

// 2. Replace the Thumbnail block exactly
let oldCardStr = `                  <div className="mb-5 w-full rounded-xl overflow-hidden border border-white/15 shadow-sm shrink-0 bg-black/20 aspect-video flex items-center justify-center">
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

if (content.includes(oldCardStr)) {
    content = content.replace(oldCardStr, updatedTestimonialCard);
} else {
    console.log("Could not find the exact old card code in Home.jsx strings.");
}

// 3. Inject new Modals at the correct bottom location
let fbStart = content.indexOf('{/* Full Screen Video Modal */}');
if (fbStart !== -1) {
  let fbEnd = content.indexOf('</div>\n        </div>\n      )}', fbStart);
  if(fbEnd === -1) fbEnd = content.indexOf('</div>\r\n        </div>\r\n      )}', fbStart);
  if (fbEnd !== -1) {
      content = content.substring(0, fbStart) + fullScreenVideoModal + '\n\n' + reviewModal + content.substring(fbEnd + 30);
  } else {
      console.log("Could not find Full Screen matching end!");
  }
}

fs.writeFileSync('C:/Users/gabas/OneDrive/Desktop/Booking System/booking-system-frontend/src/pages/Home.jsx', content);
console.log('Restored and Patched Home.');
