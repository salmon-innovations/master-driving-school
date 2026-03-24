import { useState, useEffect } from 'react'
import { useNotification } from '../context/NotificationContext'
import { newsAPI, testimonialsAPI } from '../services/api'

function Home({ onNavigate, isLoggedIn }) {
  const { showNotification } = useNotification()
  const [currentSlide, setCurrentSlide] = useState(0)
  const [promotionalVideos, setPromotionalVideos] = useState([])
  const [selectedVideo, setSelectedVideo] = useState(null)
  const [testimonials, setTestimonials] = useState([])
  const [selectedReviewMedia, setSelectedReviewMedia] = useState(null)

  // Use leading slash for public folder
  const slides = [
    { src: '/images/slider1.png', alt: 'Master Driving School - Legit at Sulit' },
    { src: '/images/slider2.jpg', alt: 'Master Driving School - Christmas Promo' },
    { src: '/images/slider3.jpg', alt: 'Master Driving School - Learn the Master Way' }
  ]

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length)
    }, 5000)
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
    const fetchVideos = async () => {
      try {
        const response = await newsAPI.getVideos()
        if (response.success) {
          setPromotionalVideos(response.videos || [])
        }
      } catch (error) {
        console.error('Failed to fetch promotional videos:', error)
      }
    }

    fetchVideos()

    return () => clearInterval(timer)
  }, [slides.length])

  const goToSlide = (index) => {
    setCurrentSlide(index)
  }

  const handleVideoClick = async (video) => {
    setSelectedVideo(video)
    try {
      if (video.id) {
        await newsAPI.incrementInteraction(video.id)
      }
    } catch (error) {
      console.error('Failed to increment view:', error)
    }
  }

  const benefits = [
    {
      icon: '✓',
      title: 'LTO-Certified Instructors',
      description: 'Learn from experienced, government-accredited professionals with 10+ years of training expertise'
    },
    {
      icon: '📅',
      title: 'Flexible Schedule',
      description: 'Book lessons 7 days a week, including weekends and holidays. Morning or afternoon slots available'
    },
    {
      icon: '💰',
      title: 'Affordable Rates',
      description: 'Quality training at competitive prices with flexible payment plans. No hidden fees guaranteed'
    },
    {
      icon: '🌐',
      title: 'Accessibility',
      description: 'Easy access to our services with convenient locations, online enrollment, and accommodations for all learners'
    },
    {
      icon: '📍',
      title: 'Multiple Locations',
      description: 'Convenient branches across Metro Manila. Choose the location closest to you'
    },
    {
      icon: '🎓',
      title: '96% Pass Rate',
      description: 'Our comprehensive training ensures excellent success rates on the first attempt'
    }
  ]

  const getMediaUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const MEDIA_BASE_URL = API_URL.replace('/api', '');
    return `${MEDIA_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const stats = [
    { number: '15+', label: 'Years of Excellence' },
    { number: '10,000+', label: 'Satisfied Students' },
    { number: '8', label: 'Branches Nationwide' },
    { number: '95%', label: 'Exam Pass Rate' }
  ]

  const specialOffers = [
    {
      title: 'Student Discount',
      discount: '20% OFF',
      description: 'Valid ID holders get special pricing',
      validUntil: 'Limited Time Offer'
    },
    {
      title: 'Group Enrollment',
      discount: '15% OFF',
      description: 'Book with 3+ friends and save',
      validUntil: 'All Year Round'
    },
    {
      title: 'Early Bird Special',
      discount: '10% OFF',
      description: 'Book morning slots (6AM-9AM)',
      validUntil: 'Ongoing Promotion'
    }
  ]

  const handleNavigate = (page) => {
    if ((page === 'payment' || page === 'booking') && !isLoggedIn) {
      showNotification("Please sign in to enroll", "error")
      onNavigate('signin')
      return
    }
    onNavigate(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="w-full">
      {/* Hero Carousel Section */}
      <section className="relative w-full h-[400px] sm:h-[500px] md:h-[600px] lg:h-[700px] overflow-hidden bg-gradient-to-br from-[#2157da] to-[#1a3a8a]">
        {/* Slides */}
        {slides.map((slide, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-1000 ${index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'
              }`}
          >
            <img
              src={slide.src}
              alt={slide.alt}
              className="w-full h-full object-cover"
              onLoad={() => console.log(`Image ${index + 1} loaded successfully`)}
              onError={(e) => {
                console.error(`Failed to load image: ${slide.src}`)
                e.target.style.display = 'none'
              }}
            />
          </div>
        ))}

        {/* Gradient Overlay for better text visibility */}
        <div className="absolute inset-0 bg-black/20 z-20"></div>

        {/* Enroll Now Button Overlay */}
        <div className="absolute inset-0 flex items-center justify-center z-30">
          <button
            onClick={() => handleNavigate('branches')}
            className="px-6 sm:px-10 md:px-12 py-3 sm:py-4 md:py-5 bg-[#F3B74C] text-[#2157da] font-bold text-base sm:text-lg md:text-xl rounded-full hover:bg-[#e1a63b] transition-all transform hover:scale-105 shadow-2xl"
          >
            Enroll Now
          </button>
        </div>

        {/* Navigation Dots */}
        <div className="absolute bottom-4 sm:bottom-8 left-0 right-0 flex justify-center space-x-2 sm:space-x-3 z-30">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full transition-all ${index === currentSlide
                ? 'bg-[#F3B74C] w-6 sm:w-8'
                : 'bg-white/50 hover:bg-white/80'
                }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>

        {/* Navigation Arrows */}
        <button
          onClick={() => goToSlide((currentSlide - 1 + slides.length) % slides.length)}
          className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 bg-white/30 hover:bg-white/50 text-white p-2 sm:p-3 rounded-full transition-all z-30"
          aria-label="Previous slide"
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={() => goToSlide((currentSlide + 1) % slides.length)}
          className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 bg-white/30 hover:bg-white/50 text-white p-2 sm:p-3 rounded-full transition-all z-30"
          aria-label="Next slide"
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </section>

      {/* Promotional Banner */}
      <section className="py-8 sm:py-12 bg-gradient-to-r from-[#F3B74C] to-[#e1a63b] w-full">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div
            className="text-center"
            data-aos="zoom-in"
          >
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#2157da] mb-3 sm:mb-4">
              Legit at Sulit Dito!
            </h2>
            <p className="text-lg sm:text-xl lg:text-2xl text-[#2157da] font-semibold mb-3 sm:mb-4">
              Save up to PHP1,500 when you avail our TDC + PDC Bundles!
            </p>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">
              ENROLL NA, KA-MASTER!
            </p>
            <button
              onClick={() => handleNavigate('branches')}
              className="mt-6 px-8 sm:px-12 py-3 sm:py-4 bg-[#2157da] text-white font-bold text-base sm:text-lg rounded-full hover:bg-[#1a3a8a] transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              Enroll Now!
            </button>
          </div>
        </div>
      </section>

      {/* Statistics Section */}
      <section className="py-12 sm:py-16 bg-[#2157da] w-full">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 max-w-6xl mx-auto">
            {stats.map((stat, index) => (
              <div
                key={index}
                className="text-center"
                data-aos="fade-up"
                data-aos-delay={index * 100}
              >
                <div className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#F3B74C] mb-2">
                  {stat.number}
                </div>
                <div className="text-sm sm:text-base text-white/90">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-12 sm:py-16 lg:py-20 bg-gray-50 w-full">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h2
            className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center text-[#2157da] mb-4"
            data-aos="fade-down"
          >
            Why Choose Master Driving School
          </h2>
          <p
            className="text-center text-gray-600 mb-8 sm:mb-12 max-w-3xl mx-auto text-sm sm:text-base"
            data-aos="fade-down"
            data-aos-delay="100"
          >
            Metro Manila's most trusted driving school with proven results and thousands of satisfied graduates
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto">
            {benefits.map((benefit, index) => (
              <div
                key={index}
                className="bg-white p-6 sm:p-8 rounded-2xl shadow-md hover:shadow-xl transition-all transform hover:-translate-y-1"
                data-aos="fade-up"
                data-aos-delay={index * 100}
              >
                <div className="text-3xl sm:text-4xl mb-4 text-center bg-[#2157da] text-white w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto">
                  {benefit.icon}
                </div>
                <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3 text-center text-gray-800">
                  {benefit.title}
                </h3>
                <p className="text-sm sm:text-base text-gray-600 text-center leading-relaxed">
                  {benefit.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      {testimonials.length > 0 && (
      <section className="py-12 sm:py-16 lg:py-20 bg-white w-full">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h2
            className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center text-[#2157da] mb-4"
            data-aos="fade-down"
          >
            What Our Students Say
          </h2>
          <p
            className="text-center text-gray-600 mb-8 sm:mb-12 text-sm sm:text-base"
            data-aos="fade-down"
            data-aos-delay="100"
          >
            Real experiences from real students who learned to drive with confidence
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto">
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
        </div>
      </section>
      )}

      {/* How It Works Section */}
      <section className="py-12 sm:py-16 lg:py-20 bg-gray-50 w-full">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h2
            className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center text-[#2157da] mb-12"
            data-aos="fade-down"
          >
            Get Started in 3 Easy Steps
          </h2>
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center" data-aos="flip-left" data-aos-delay="0">
                <div className="bg-[#2157da] text-white w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                  1
                </div>
                <h3 className="text-xl font-semibold mb-3 text-gray-800">Choose Your Course</h3>
                <p className="text-gray-600">Select from our range of driving courses that fit your needs and budget</p>
              </div>
              <div className="text-center" data-aos="flip-left" data-aos-delay="150">
                <div className="bg-[#2157da] text-white w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                  2
                </div>
                <h3 className="text-xl font-semibold mb-3 text-gray-800">Enroll Your Schedule</h3>
                <p className="text-gray-600">Pick a convenient time and location. We work around your schedule</p>
              </div>
              <div className="text-center" data-aos="flip-left" data-aos-delay="300">
                <div className="bg-[#2157da] text-white w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                  3
                </div>
                <h3 className="text-xl font-semibold mb-3 text-gray-800">Start Learning</h3>
                <p className="text-gray-600">Begin your journey to becoming a confident, skilled driver</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Video Section */}
      <section className="py-14 sm:py-20 lg:py-24 w-full bg-gradient-to-br from-[#0d1b4b] via-[#1a2d6b] to-[#0d1b4b] relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-0 left-0 w-72 h-72 bg-[#F3B74C] rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#2157da] rounded-full blur-3xl translate-x-1/3 translate-y-1/3"></div>
        </div>

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          {/* Section Header */}
          <div className="text-center mb-10 sm:mb-14" data-aos="fade-up">
            <span className="inline-block px-4 py-1.5 bg-[#F3B74C]/20 text-[#F3B74C] text-xs font-bold uppercase tracking-widest rounded-full mb-4">
              🎬 Featured Videos
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-4 leading-tight">
              See Us in <span className="text-[#F3B74C]">Action</span>
            </h2>
            <p className="text-blue-200 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
              Watch real student experiences, behind-the-scenes moments, and promotional videos from Master Driving School
            </p>
          </div>

          {/* Video Grid */}
          {promotionalVideos.length > 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5 max-w-6xl mx-auto">
              {promotionalVideos.slice(0, 4).map((video, index) => (
                <div
                  key={video.id || index}
                  className="group relative rounded-2xl overflow-hidden cursor-pointer shadow-xl hover:shadow-2xl hover:shadow-[#F3B74C]/20 transition-all duration-300 hover:-translate-y-1"
                  data-aos="fade-up"
                  data-aos-delay={index * 100}
                  onClick={() => handleVideoClick(video)}
                >
                  {/* Thumbnail */}
                  <div className="relative bg-black" style={{ aspectRatio: '9/16' }}>
                    {video.media_url && video.media_url.startsWith('data:video') ? (
                      <video
                        className="w-full h-full object-cover pointer-events-none"
                        src={video.media_url}
                        muted
                        playsInline
                        preload="metadata"
                      ></video>
                    ) : (
                      <iframe
                        className="w-full h-full pointer-events-none"
                        src={video.media_url}
                        title={video.title}
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      ></iframe>
                    )}

                    {/* Dark gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent group-hover:from-black/60 transition-all duration-300"></div>

                    {/* Play Button */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[#F3B74C] rounded-full flex items-center justify-center shadow-lg shadow-[#F3B74C]/40 transform group-hover:scale-110 group-hover:shadow-xl transition-all duration-300">
                        <svg className="w-5 h-5 sm:w-6 sm:h-6 text-[#1a2d6b] ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>

                    {/* Title inside card (bottom) */}
                    <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4">
                      <h3 className="text-white font-bold text-sm sm:text-base leading-tight line-clamp-2 drop-shadow-md">
                        {video.title}
                      </h3>
                      {video.content && (
                        <p className="text-blue-200 text-xs mt-1 line-clamp-1 drop-shadow">
                          {video.content}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.882v6.236a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-blue-200 text-base">Check back soon for exciting videos from Master Driving School!</p>
            </div>
          )}

          {/* CTA Buttons */}
          <div className="text-center mt-10 sm:mt-14" data-aos="fade-up" data-aos-delay="200">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center">
              <button
                onClick={() => handleNavigate('news')}
                className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-3.5 bg-white/10 backdrop-blur-sm text-white font-semibold rounded-full border border-white/30 hover:bg-white/20 transition-all text-sm sm:text-base"
              >
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.882v6.236a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  See More Videos
                </span>
              </button>
              <button
                onClick={() => handleNavigate('branches')}
                className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-3.5 bg-[#F3B74C] text-[#1a2d6b] font-bold rounded-full hover:bg-[#e1a63b] transition-all text-sm sm:text-base shadow-lg shadow-[#F3B74C]/30 hover:shadow-xl hover:shadow-[#F3B74C]/40 transform hover:scale-105"
              >
                Enroll Now →
              </button>
            </div>
          </div>
        </div>
      </section>


      {/* Our Partners Section */}
      <section className="py-12 sm:py-16 lg:py-20 bg-gray-50 w-full">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h2
            className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center text-[#2157da] mb-4"
            data-aos="fade-down"
          >
            Our Partners
          </h2>
          <p
            className="text-center text-gray-600 mb-8 sm:mb-12 text-sm sm:text-base max-w-2xl mx-auto"
            data-aos="fade-down"
            data-aos-delay="100"
          >
            Proud to partner with leading organizations in automotive safety and driver education
          </p>
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 items-center">
              <div
                className="bg-white p-6 rounded-xl shadow-md hover:shadow-xl transition-all flex items-center justify-center h-32"
                data-aos="flip-up"
                data-aos-delay="0"
              >
                <div className="text-center">
                  <div className="text-4xl mb-2">🚗</div>
                  <p className="text-sm font-semibold text-gray-700">LTO Philippines</p>
                </div>
              </div>
              <div
                className="bg-white p-6 rounded-xl shadow-md hover:shadow-xl transition-all flex items-center justify-center h-32"
                data-aos="flip-up"
                data-aos-delay="100"
              >
                <div className="text-center">
                  <div className="text-4xl mb-2">🛡️</div>
                  <p className="text-sm font-semibold text-gray-700">DOTr</p>
                </div>
              </div>
              <div
                className="bg-white p-6 rounded-xl shadow-md hover:shadow-xl transition-all flex items-center justify-center h-32"
                data-aos="flip-up"
                data-aos-delay="200"
              >
                <div className="text-center">
                  <div className="text-4xl mb-2">🏢</div>
                  <p className="text-sm font-semibold text-gray-700">TESDA</p>
                </div>
              </div>
              <div
                className="bg-white p-6 rounded-xl shadow-md hover:shadow-xl transition-all flex items-center justify-center h-32"
                data-aos="flip-up"
                data-aos-delay="300"
              >
                <div className="text-center">
                  <div className="text-4xl mb-2">⚙️</div>
                  <p className="text-sm font-semibold text-gray-700">AAP</p>
                </div>
              </div>
              <div
                className="bg-white p-6 rounded-xl shadow-md hover:shadow-xl transition-all flex items-center justify-center h-32"
                data-aos="flip-up"
                data-aos-delay="400"
              >
                <div className="text-center">
                  <div className="text-4xl mb-2">🚙</div>
                  <p className="text-sm font-semibold text-gray-700">Toyota PH</p>
                </div>
              </div>
              <div
                className="bg-white p-6 rounded-xl shadow-md hover:shadow-xl transition-all flex items-center justify-center h-32"
                data-aos="flip-up"
                data-aos-delay="500"
              >
                <div className="text-center">
                  <div className="text-4xl mb-2">🔧</div>
                  <p className="text-sm font-semibold text-gray-700">Honda PH</p>
                </div>
              </div>
              <div
                className="bg-white p-6 rounded-xl shadow-md hover:shadow-xl transition-all flex items-center justify-center h-32"
                data-aos="flip-up"
                data-aos-delay="600"
              >
                <div className="text-center">
                  <div className="text-4xl mb-2">💼</div>
                  <p className="text-sm font-semibold text-gray-700">Petron</p>
                </div>
              </div>
              <div
                className="bg-white p-6 rounded-xl shadow-md hover:shadow-xl transition-all flex items-center justify-center h-32"
                data-aos="flip-up"
                data-aos-delay="700"
              >
                <div className="text-center">
                  <div className="text-4xl mb-2">🏆</div>
                  <p className="text-sm font-semibold text-gray-700">Shell</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Indicators Section */}
      <section className="py-12 sm:py-16 bg-[#2157da] w-full">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3
            className="text-xl sm:text-2xl font-semibold text-white mb-6"
            data-aos="fade-down"
          >
            Trusted & Accredited By
          </h3>
          <div className="flex flex-wrap justify-center items-center gap-6 sm:gap-8 text-white/80" data-aos="fade-up">
            <div className="text-center">
              <div className="text-3xl mb-2">🏆</div>
              <p className="text-xs sm:text-sm">LTO Accredited</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">✅</div>
              <p className="text-xs sm:text-sm">DOTr Certified</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">🛡️</div>
              <p className="text-xs sm:text-sm">Fully Insured</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">⭐</div>
              <p className="text-xs sm:text-sm">5-Star Rated</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-16 sm:py-20 lg:py-24 bg-gradient-to-r from-[#2157da] to-[#1a3a8a] w-full">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6"
            data-aos="zoom-in"
          >
            Ready to Start Your Driving Journey?
          </h2>
          <p
            className="text-base sm:text-lg lg:text-xl text-white/90 mb-8 sm:mb-10 max-w-3xl mx-auto px-4"
            data-aos="zoom-in"
            data-aos-delay="100"
          >
            Join over 10,000 satisfied students who have learned to drive safely and confidently with Metro Manila's #1 driving school.
          </p>
          <div
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            data-aos="zoom-in"
            data-aos-delay="200"
          >
            <button
              onClick={() => handleNavigate('branches')}
              className="px-8 sm:px-10 py-3 sm:py-4 bg-[#F3B74C] text-[#2157da] font-bold text-base sm:text-lg rounded-full hover:bg-[#e1a63b] transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              Book Your First Lesson Now
            </button>
            <button
              onClick={() => handleNavigate('courses')}
              className="px-8 sm:px-10 py-3 sm:py-4 bg-white text-[#2157da] font-semibold text-base sm:text-lg rounded-full hover:bg-gray-100 transition-all shadow-md"
            >
              Explore Our Courses
            </button>
          </div>
          <p className="text-white/80 text-sm sm:text-base mt-6">
            💳 Flexible payment options available | 📞 Call us: 0915 644 9441
          </p>
        </div>
      </section>

      {/* Full Screen Video Modal */}
      {selectedVideo && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 sm:p-8 backdrop-blur-sm"
          onClick={() => setSelectedVideo(null)}
        >
          <button
            className="absolute top-4 right-4 sm:top-8 sm:right-8 text-white hover:text-[#F3B74C] z-[110] transition-colors"
            onClick={() => setSelectedVideo(null)}
          >
            <svg className="w-10 h-10 shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div
            className="relative w-full max-w-5xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedVideo.media_url && selectedVideo.media_url.startsWith('data:video') ? (
              <video
                className="w-full h-full flex outline-none"
                src={selectedVideo.media_url}
                title={selectedVideo.title}
                controls
                autoPlay
                playsInline
              ></video>
            ) : (
              <iframe
                className="w-full h-full border-0"
                src={selectedVideo.media_url || "https://www.youtube.com/embed/dQw4w9WgXcQ"}
                title={selectedVideo.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            )}
          </div>
        </div>
      )}
          {/* Review Media Modal */}
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
      )}
</div>
  )
}

export default Home
