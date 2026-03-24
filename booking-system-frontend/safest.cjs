const fs = require('fs');
let c = fs.readFileSync('src/pages/Home.jsx', 'utf8');

const anchorA = '{testimonials.slice(0, 5).map((testimonial, index) => (';
const anchorB = '            ))}';

let startIdx = c.indexOf(anchorA);
if (startIdx === -1) process.exit(1);
startIdx += anchorA.length;

let endIdx = c.indexOf(anchorB, startIdx);
if (endIdx === -1) process.exit(1);

const newCardStr = `
              <div
                key={index}
                className="bg-[#1c3f94] p-5 sm:p-6 rounded-2xl shadow-md text-white flex flex-col h-full hover:shadow-xl transition-shadow"
                data-aos="fade-up"
                data-aos-delay={index * 150}
              >
                  {/* MEDIA SECTION */}
                  <div className="mb-4 w-full rounded-xl overflow-hidden shadow-sm shrink-0 bg-black/20 aspect-video flex items-center justify-center relative group">
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
                        <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-xl mb-2">▶</div>
                        <p className="text-xs text-white/80 font-medium">No media provided</p>
                      </div>
                    )}
                  </div>

                  {/* STARS - Left aligned */}
                  <div className="flex mb-3 justify-start px-1">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <span key={i} className="text-[#F3B74C] text-lg lg:text-xl drop-shadow-sm">★</span>
                    ))}
                  </div>

                  {/* QUOTE - Centered */}
                  <div className="w-full text-center flex-grow flex items-center justify-center mb-5 px-2">
                    <p className="text-sm sm:text-base leading-relaxed italic font-semibold text-white/95">
                      "{testimonial.comment}"
                    </p>
                  </div>

                  {/* BOTTOM INFO - Centered with Top Line */}
                  <div className="border-t border-white/10 pt-4 w-full text-center mt-auto px-2">
                    <p className="font-bold text-base sm:text-lg tracking-wide">{testimonial.name}</p>
                    <p className="text-xs sm:text-sm text-gray-300 mt-1">{testimonial.location || 'Branch Student'}</p>
                    <p className="text-xs sm:text-sm text-[#F3B74C] font-semibold mt-1.5">{testimonial.course}</p>
                  </div>
              </div>
`;

c = c.substring(0, startIdx) + newCardStr + c.substring(endIdx);
fs.writeFileSync('src/pages/Home.jsx', c, 'utf8');
console.log('SUCCESS!');
