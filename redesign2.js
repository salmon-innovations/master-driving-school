const fs = require('fs');

const cardUI = `              <div key={index} className="bg-white rounded-xl shadow-[0_4px_20px_rgb(0,0,0,0.06)] border border-gray-100 overflow-hidden flex flex-col h-full hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all duration-300 transform hover:-translate-y-1">
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
`;


function patchFile(filePath, isHome) {
    let content = fs.readFileSync(filePath, 'utf8');

    let mapStartRegex = isHome ? /{testimonials(?:\.slice\([^)]+\))?\.map\(\([^)]+\)\s*=>\s*\(/ : /{testimonials\.map\(\([^)]+\)\s*=>\s*\(/;
    let match = content.match(mapStartRegex);
    if (!match) {
        console.log('Could not find map block in ' + filePath);
        return;
    }
    
    let startIndex = match.index + match[0].length;
    
    // To correctly find the outermost closing brackets of the map, 
    // simply find the FIRST `          </div>` that occurs after a few occurrences of `))}`
    let nextDivEndStr;
    if (isHome) {
         nextDivEndStr = '          </div>\n          <div className="flex justify-center mt-8">';
    } else {
         nextDivEndStr = '        ) : ('; 
    }
    
    let endIndex = content.indexOf(nextDivEndStr);
    
    if(endIndex === -1) {
        // Fallback for home without See All reviews yet or windows CRLF
        if (isHome) {
           endIndex = content.indexOf('          </div>\r\n          <div className="flex justify-center mt-8">');
           if (endIndex === -1) {
                // just find the end of grid container
                endIndex = content.indexOf('          </div>\n        </div>\n      </section>');
                if(endIndex === -1) endIndex = content.indexOf('          </div>\r\n        </div>\r\n      </section>');
           }
        }
        if (!isHome) {
           let endText = '            </div>\n        ) : (';
           endIndex = content.indexOf(endText);
           if(endIndex === -1) endText = '            </div>\r\n        ) : (';
           endIndex = content.indexOf(endText);
           if(endIndex !== -1) endIndex += 14; 
        }
    }

    if (endIndex === -1) {
        console.log("Could not find block end. Doing rough trim based on slice.");
        return;
    }
    
    // wait for `Home.jsx`, if we found `</div> </div> </section>`, we just want to replace to the `            ))} \n          </div>`
    // So the replacement body ends with `\n            ))} \n`
    let replacement = content.substring(0, startIndex) + '\n' + cardUI + '            ))}\n' + content.substring(endIndex);
    
    // Note: For Reviews.jsx it ends right before `</div>` or `) : (`.
    if (!isHome) {
        let revEnd = content.indexOf('            </div>\n        ) : (');
        if(revEnd === -1) revEnd = content.indexOf('            </div>\r\n        ) : (');
        if(revEnd !== -1) {
             replacement = content.substring(0, startIndex) + '\n' + cardUI + '            ))}\n' + content.substring(revEnd);
        }
    }

    fs.writeFileSync(filePath, replacement);
    console.log('Successfully redesigned ' + filePath);
}

const homePath = 'C:/Users/gabas/OneDrive/Desktop/Booking System/booking-system-frontend/src/pages/Home.jsx';
const revPath = 'C:/Users/gabas/OneDrive/Desktop/Booking System/booking-system-frontend/src/pages/Reviews.jsx';

patchFile(homePath, true);
patchFile(revPath, false);
