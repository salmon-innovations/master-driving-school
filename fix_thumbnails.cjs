const fs = require('fs');

function fixFiles() {
  const homePath = 'C:/Users/gabas/OneDrive/Desktop/Booking System/booking-system-frontend/src/pages/Home.jsx';
  const reviewsPath = 'C:/Users/gabas/OneDrive/Desktop/Booking System/booking-system-frontend/src/pages/Reviews.jsx';

  let homeCode = fs.readFileSync(homePath, 'utf8');
  let reviewsCode = fs.readFileSync(reviewsPath, 'utf8');

  const replacement = `<div className="mb-5 w-full rounded-xl overflow-hidden border border-white/15 shadow-sm shrink-0 bg-black/20 aspect-video flex items-center justify-center relative group">
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

  const regex = /<div className="mb-5 w-full rounded-xl overflow-hidden border border-white\/15 shadow-sm shrink-0 bg-black\/20 aspect-video flex items-center justify-center">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/;

  homeCode = homeCode.replace(regex, replacement + '\n                <div className="border-t border-white/20 pt-5 w-full text-center mt-auto">');
  reviewsCode = reviewsCode.replace(regex, replacement + '\n                <div className="border-t border-white/20 pt-4 w-full text-center mt-auto">');

  fs.writeFileSync(homePath, homeCode);
  fs.writeFileSync(reviewsPath, reviewsCode);
  console.log("Replaced thumbnails!");
}

fixFiles();
