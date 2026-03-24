const fs = require('fs');

function patchModals() {
    // ---------------- HOME.JSX ---------------- //
    let homePath = 'C:\\Users\\gabas\\OneDrive\\Desktop\\Booking System\\booking-system-frontend\\src\\pages\\Home.jsx';
    let homeContent = fs.readFileSync(homePath, 'utf8');

    // 1. Replace Review Media Modal
    let reviewStartStr = '{/* Review Media Modal */}';
    let reviewEndStr = ')}';
    let rStart = homeContent.indexOf(reviewStartStr);
    
    // Find the end pattern for Review Media Modal.
    // Let's use substring matching
    let afterRStart = homeContent.substring(rStart);
    let rClosingDiv = afterRStart.indexOf('</div>\n        </div>\n      )}');
    if (rClosingDiv === -1) rClosingDiv = afterRStart.indexOf('</div>\r\n        </div>\r\n      )}');
    
    if (rStart !== -1 && rClosingDiv !== -1) {
        let replacementReview = `{/* Review Media Modal */}
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
        
        homeContent = homeContent.substring(0, rStart) + replacementReview + afterRStart.substring(rClosingDiv + 30);
    }

    // 2. Replace Full Screen Video Modal
    let videoStartStr = '{/* Full Screen Video Modal */}';
    let vStart = homeContent.indexOf(videoStartStr);
    
    let afterVStart = homeContent.substring(vStart);
    let vClosingDiv = afterVStart.indexOf('</div>\n        </div>\n      )}');
    if (vClosingDiv === -1) vClosingDiv = afterVStart.indexOf('</div>\r\n        </div>\r\n      )}');

    if (vStart !== -1 && vClosingDiv !== -1) {
        let replacementVideo = `{/* Full Screen Video Modal */}
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
        
        homeContent = homeContent.substring(0, vStart) + replacementVideo + afterVStart.substring(vClosingDiv + 30);
    }
    
    fs.writeFileSync(homePath, homeContent);
    console.log('Home.jsx replaced.');


    // ---------------- REVIEWS.JSX ---------------- //
    let reviewsPath = 'C:\\Users\\gabas\\OneDrive\\Desktop\\Booking System\\booking-system-frontend\\src\\pages\\Reviews.jsx';
    let reviewsContent = fs.readFileSync(reviewsPath, 'utf8');

    let rvStart = reviewsContent.indexOf(reviewStartStr);
    if (rvStart !== -1) {
        let afterRvStart = reviewsContent.substring(rvStart);
        let rvClosingDiv = afterRvStart.indexOf('</div>\n        </div>\n      )}');
        if (rvClosingDiv === -1) rvClosingDiv = afterRvStart.indexOf('</div>\r\n        </div>\r\n      )}');
        
        if (rvClosingDiv !== -1) {
            let replacementReview = `{/* Review Media Modal */}
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
            
            reviewsContent = reviewsContent.substring(0, rvStart) + replacementReview + afterRvStart.substring(rvClosingDiv + 30);
            fs.writeFileSync(reviewsPath, reviewsContent);
            console.log('Reviews.jsx replaced.');
        }
    }
}

patchModals();
