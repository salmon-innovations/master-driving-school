const fs = require('fs');
const content = `import React, { useState, useEffect } from 'react';
import { testimonialsAPI } from '../services/api';

function Reviews({ onNavigate }) {
  const [testimonials, setTestimonials] = useState([]);

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
    return \`\${MEDIA_BASE_URL}\${url.startsWith('/') ? '' : '/'}\${url}\`;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pt-24 pb-12 w-full">
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm">
          <div>
            <h1 className="text-3xl font-bold text-[#2157da]">All Student Reviews</h1>
            <p className="text-gray-600 mt-2">See what our students are saying about their driving experience.</p>
          </div>
          <button
            onClick={() => onNavigate('home')}
            className="px-6 py-2 bg-gray-100 text-gray-700 font-semibold rounded-full hover:bg-gray-200 transition-all"
          >
            Back to Home
          </button>
        </div>

        {testimonials.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-stretch">
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                className="bg-gradient-to-br from-[#2157da] to-[#1a3a8a] p-6 rounded-2xl shadow-lg text-white flex flex-col h-full"
              >
                <div className="flex mb-4 justify-start">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <span key={i} className="text-[#F3B74C] text-xl">★</span>
                  ))}
                </div>

                <div className="w-full min-h-[90px] text-center mb-5 flex items-start justify-center">
                  <p className="text-sm leading-relaxed italic text-white/95">
                    "{testimonial.comment}"
                  </p>
                </div>

                <div className="mb-5 w-full rounded-xl overflow-hidden border border-white/15 shadow-sm shrink-0 bg-black/20 aspect-video flex items-center justify-center">
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
                </div>
                
                <div className="border-t border-white/20 pt-4 w-full text-center mt-auto">
                  <p className="font-bold text-base tracking-wide">{testimonial.name}</p>
                  <p className="text-xs text-white/80 mt-0.5">{testimonial.location}</p>
                  <p className="text-xs text-[#F3B74C] mt-1.5 font-semibold text-opacity-90">{testimonial.course}</p>
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
    </div>
  );
}

export default Reviews;
`;
fs.writeFileSync('C:\\Users\\gabas\\OneDrive\\Desktop\\Booking System\\booking-system-frontend\\src\\pages\\Reviews.jsx', content);
