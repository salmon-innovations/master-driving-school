const fs = require('fs');

const fixHome = () => {
    let content = fs.readFileSync('C:\\Users\\gabas\\OneDrive\\Desktop\\Booking System\\booking-system-frontend\\src\\pages\\Home.jsx', 'utf8');

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
                          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors backdrop-blur-sm">
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
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
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

    const reviewModal = `
      {/* Review Media Modal */}
      {selectedReviewMedia && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 sm:p-8 backdrop-blur-sm"
          onClick={() => setSelectedReviewMedia(null)}
        >
          <button
            className="absolute top-4 right-4 sm:top-8 sm:right-8 text-white hover:text-[#F3B74C] z-[110] transition-colors p-2"
            onClick={() => setSelectedReviewMedia(null)}
          >
            <svg className="w-10 h-10 shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <div 
            className="relative w-full max-w-5xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-white/10 flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedReviewMedia.type === 'video' ? (
              <video
                className="w-full h-full object-contain outline-none"
                src={selectedReviewMedia.url}
                controls
                autoPlay
                playsInline
              />
            ) : (
              <img
                src={selectedReviewMedia.url}
                alt="Review Full View"
                className="max-w-full max-h-full object-contain"
              />
            )}
          </div>
        </div>
      )}
`;

    if (!content.includes('const [selectedReviewMedia')) {
        content = content.replace('const [selectedVideo, setSelectedVideo] = useState(null)', 'const [selectedVideo, setSelectedVideo] = useState(null)\n  const [selectedReviewMedia, setSelectedReviewMedia] = useState(null)');
    }

    const reg = /<div className="mb-5 w-full rounded-xl overflow-hidden border border-white\/15 shadow-sm shrink-0 bg-black\/20 aspect-video flex items-center justify-center">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/;
    
    // Instead of regex lets do string replace
    let replaceStart = '<div className="mb-5 w-full rounded-xl overflow-hidden border border-white/15 shadow-sm shrink-0 bg-black/20 aspect-video flex items-center justify-center">';
    let replaceEndIndex = content.indexOf(' border-t border-white/20', content.indexOf(replaceStart));
    
    const block = content.substring(content.indexOf(replaceStart), replaceEndIndex);

    let originalMediaBlock = `                  <div className="mb-5 w-full rounded-xl overflow-hidden border border-white/15 shadow-sm shrink-0 bg-black/20 aspect-video flex items-center justify-center">
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

    content = content.replace(originalMediaBlock, updatedTestimonialCard);

    if (!content.includes('{selectedReviewMedia && (')) {
        content = content.replace('{/* Full Screen Video Modal */}', reviewModal + '\n      {/* Full Screen Video Modal */}');
    }

    fs.writeFileSync('C:\\Users\\gabas\\OneDrive\\Desktop\\Booking System\\booking-system-frontend\\src\\pages\\Home.jsx', content);
    console.log('Home.jsx patched for modal');
}

fixHome();

const fixReviews = () => {
    let content = fs.readFileSync('C:\\Users\\gabas\\OneDrive\\Desktop\\Booking System\\booking-system-frontend\\src\\pages\\Reviews.jsx', 'utf8');

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
                          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors backdrop-blur-sm">
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
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
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

    const reviewModal = `
      {/* Review Media Modal */}
      {selectedReviewMedia && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 sm:p-8 backdrop-blur-sm"
          onClick={() => setSelectedReviewMedia(null)}
        >
          <button
            className="absolute top-4 right-4 sm:top-8 sm:right-8 text-white hover:text-[#F3B74C] z-[110] transition-colors p-2"
            onClick={() => setSelectedReviewMedia(null)}
          >
            <svg className="w-10 h-10 shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <div 
            className="relative w-full max-w-5xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-white/10 flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedReviewMedia.type === 'video' ? (
              <video
                className="w-full h-full object-contain outline-none"
                src={selectedReviewMedia.url}
                controls
                autoPlay
                playsInline
              />
            ) : (
              <img
                src={selectedReviewMedia.url}
                alt="Review Full View"
                className="max-w-full max-h-full object-contain"
              />
            )}
          </div>
        </div>
      )}
`;

    if (!content.includes('const [selectedReviewMedia')) {
        content = content.replace('const [testimonials, setTestimonials] = useState([]);', 'const [testimonials, setTestimonials] = useState([]);\n  const [selectedReviewMedia, setSelectedReviewMedia] = useState(null);');
    }

    let originalMediaBlock = `                  <div className="mb-5 w-full rounded-xl overflow-hidden border border-white/15 shadow-sm shrink-0 bg-black/20 aspect-video flex items-center justify-center">
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

    content = content.replace(originalMediaBlock, updatedTestimonialCard);

    if (!content.includes('{selectedReviewMedia && (')) {
        content = content.replace('</main>', '</main>\n' + reviewModal);
    }

    fs.writeFileSync('C:\\Users\\gabas\\OneDrive\\Desktop\\Booking System\\booking-system-frontend\\src\\pages\\Reviews.jsx', content);
    console.log('Reviews.jsx patched for modal');
}

fixReviews();
