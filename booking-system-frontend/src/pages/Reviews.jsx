import React, { useState, useEffect } from 'react';
import { testimonialsAPI } from '../services/api';

function Reviews({ onNavigate }) {
  const [testimonials, setTestimonials] = useState([]);
  const [selectedReviewMedia, setSelectedReviewMedia] = useState(null);

  useEffect(() => {
    // Scroll to top when loaded
    window.scrollTo(0, 0);

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
  }, []);

  const getMediaUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const MEDIA_BASE_URL = API_URL.replace('/api', '');
    return `${MEDIA_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center">
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 flex-grow">
        <div className="mb-10 text-center">
          <h1 className="text-3xl md:text-5xl font-extrabold text-[#2157da] mb-4 drop-shadow-sm">Student Reviews</h1>
          <p className="text-[#2157da]/80 text-lg max-w-2xl mx-auto font-medium">
            Discover what our successful students say about their Master Driving School experience!
          </p>
        </div>

        {testimonials.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-stretch">
              {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-white rounded-xl shadow-[0_4px_20px_rgb(0,0,0,0.06)] border border-gray-100 overflow-hidden flex flex-col h-full hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all duration-300 transform hover:-translate-y-1">
                {/* TOP MEDIA AREA - FLUSH TO EDGES */}
                <div className="w-full aspect-video bg-gray-100 relative group overflow-hidden shrink-0">
                  {testimonial.videoUrl ? (
                    <>
                      <video className="w-full h-full object-cover block cursor-pointer" preload="metadata" onClick={() => setSelectedReviewMedia({ type: 'video', url: getMediaUrl(testimonial.videoUrl) })}>
                        <source src={getMediaUrl(testimonial.videoUrl)} type="video/mp4" />
                      </video>
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-14 h-14 rounded-full bg-white/90 shadow-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                          <span className="text-[#2157da] text-2xl ml-1">▶</span>
                        </div>
                      </div>
                    </>
                  ) : testimonial.imageUrl ? (
                    <div className="relative w-full h-full cursor-pointer" onClick={() => setSelectedReviewMedia({ type: 'image', url: getMediaUrl(testimonial.imageUrl) })}>
                      <img src={getMediaUrl(testimonial.imageUrl)} alt="Student Review" className="w-full h-full object-cover block transition-transform duration-500 group-hover:scale-110" />
                      <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    </div>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-gray-100">
                      <svg className="w-12 h-12 text-blue-200 mb-2" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
                      <span className="text-gray-400 text-sm font-medium">Student Review</span>
                    </div>
                  )}
                </div>

                {/* BOTTOM CONTENT AREA */}
                <div className="p-5 sm:p-6 flex flex-col grow">
                  <div className="flex items-center gap-1 mb-3">
                    {[...Array(testimonial.rating || 5)].map((_, i) => (
                      <span key={i} className="text-[#F3B74C] text-lg">★</span>
                    ))}
                  </div>
                  
                  <p className="text-gray-600 text-sm leading-relaxed mb-6 grow line-clamp-4 relative">
                    <span className="text-3xl text-gray-200 absolute -top-4 -left-2">"</span>
                    <span className="relative z-10 italic">{(testimonial.comment && testimonial.comment !== 'No comment') ? testimonial.comment : 'Excellent driving school! The instructors were very patient and I learned a lot.'}</span>
                  </p>

                  <div className="pt-4 border-t border-gray-100 flex items-center gap-3 mt-auto">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#2157da] to-blue-400 text-white flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
                      {testimonial.name ? testimonial.name.charAt(0).toUpperCase() : 'S'}
                    </div>
                    <div className="overflow-hidden">
                      <h4 className="font-bold text-gray-900 text-sm truncate">{testimonial.name || 'Student'}</h4>
                      <p className="text-xs text-[#2157da] font-medium truncate mt-0.5">{testimonial.course && testimonial.course.replace(/Course/g, '') || 'Driving Student'}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-2xl shadow-sm">
            <p className="text-gray-500 text-lg">No reviews available currently.</p>
          </div>
        )}
      </main>

      {/* Review Media Modal */}
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
      )}
    </div>
  );
}

export default Reviews;
