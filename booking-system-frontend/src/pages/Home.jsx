import { useState, useEffect } from 'react'
import { useNotification } from '../context/NotificationContext'

function Home({ onNavigate, isLoggedIn }) {
  const { showNotification } = useNotification()
  const [currentSlide, setCurrentSlide] = useState(0)
  
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

    return () => clearInterval(timer)
  }, [slides.length])

  const goToSlide = (index) => {
    setCurrentSlide(index)
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

  const testimonials = [
    {
      name: 'Maria Santos',
      location: 'Makati',
      rating: 5,
      comment: 'Best driving school in Manila! I passed my exam on the first try. The instructors are patient and professional.',
      course: 'Manual Transmission Course'
    },
    {
      name: 'Juan Reyes',
      location: 'Quezon City',
      rating: 5,
      comment: 'Flexible schedule and affordable prices. Highly recommend to anyone who wants to learn driving properly.',
      course: 'Automatic Transmission Course'
    },
    {
      name: 'Sarah Chen',
      location: 'Pasig',
      rating: 5,
      comment: 'The defensive driving lessons were invaluable. I feel confident and safe on the road now. Worth every peso!',
      course: 'Defensive Driving Course'
    }
  ]

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
            className={`absolute inset-0 transition-opacity duration-1000 ${
              index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'
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
            onClick={() => handleNavigate('payment')}
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
              className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full transition-all ${
                index === currentSlide 
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
              onClick={() => handleNavigate('payment')}
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

      {/* Special Offers Section */}
      <section className="py-12 sm:py-16 lg:py-20 bg-gradient-to-br from-[#F3B74C] to-[#e1a63b] w-full">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h2 
            className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center text-[#2157da] mb-4"
            data-aos="fade-down"
          >
            🎉 Special Promotions
          </h2>
          <p 
            className="text-center text-[#2157da]/80 mb-8 sm:mb-12 text-sm sm:text-base"
            data-aos="fade-down"
            data-aos-delay="100"
          >
            Save more when you enroll now! Limited slots available.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto">
            {specialOffers.map((offer, index) => (
              <div
                key={index}
                className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all transform hover:-translate-y-2"
                data-aos="zoom-in"
                data-aos-delay={index * 150}
              >
                <div className="text-center">
                  <div className="text-3xl sm:text-4xl font-bold text-[#2157da] mb-3">
                    {offer.discount}
                  </div>
                  <h3 className="text-xl sm:text-2xl font-semibold mb-3 text-gray-800">
                    {offer.title}
                  </h3>
                  <p className="text-sm sm:text-base text-gray-600 mb-4">
                    {offer.description}
                  </p>
                  <div className="inline-block px-4 py-2 bg-[#2157da]/10 text-[#2157da] text-xs sm:text-sm font-semibold rounded-full">
                    {offer.validUntil}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-8 sm:mt-12">
            <button
              onClick={() => handleNavigate('payment')}
              className="px-8 sm:px-12 py-3 sm:py-4 bg-[#2157da] text-white font-bold text-base sm:text-lg rounded-full hover:bg-[#1a3a8a] transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              Enroll Now & Save!
            </button>
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
              <div
                key={index}
                className="bg-gradient-to-br from-[#2157da] to-[#1a3a8a] p-6 sm:p-8 rounded-2xl shadow-lg text-white"
                data-aos="fade-up"
                data-aos-delay={index * 150}
              >
                <div className="flex mb-3">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <span key={i} className="text-[#F3B74C] text-xl">★</span>
                  ))}
                </div>
                <p className="text-sm sm:text-base mb-4 leading-relaxed italic">
                  "{testimonial.comment}"
                </p>
                <div className="border-t border-white/20 pt-4">
                  <p className="font-semibold text-base sm:text-lg">{testimonial.name}</p>
                  <p className="text-xs sm:text-sm text-white/80">{testimonial.location}</p>
                  <p className="text-xs sm:text-sm text-[#F3B74C] mt-1">{testimonial.course}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

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
      <section className="py-12 sm:py-16 lg:py-20 bg-white w-full">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8 sm:mb-12">
              <h2 
                className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#2157da] mb-4"
                data-aos="fade-down"
              >
                See Master Driving School in Action
              </h2>
              <p 
                className="text-gray-600 text-sm sm:text-base max-w-3xl mx-auto"
                data-aos="fade-down"
                data-aos-delay="100"
              >
                Watch student experiences, promotional videos, and see how we train drivers to succeed
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
              {/* Video 1 - Main Promotional Video */}
              <div 
                className="bg-gray-50 rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all"
                data-aos="zoom-in"
                data-aos-delay="0"
              >
                <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                  <iframe
                    className="absolute top-0 left-0 w-full h-full"
                    src="https://www.youtube.com/embed/dQw4w9WgXcQ"
                    title="Master Driving School - Main Promo"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  ></iframe>
                </div>
                <div className="p-4 sm:p-6">
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2">
                    Welcome to Master Driving School
                  </h3>
                  <p className="text-sm sm:text-base text-gray-600">
                    Learn why we're Metro Manila's #1 choice for driving education
                  </p>
                </div>
              </div>

              {/* Video 2 - Student Experience */}
              <div 
                className="bg-gray-50 rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all"
                data-aos="zoom-in"
                data-aos-delay="150"
              >
                <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                  <iframe
                    className="absolute top-0 left-0 w-full h-full"
                    src="https://www.youtube.com/embed/dQw4w9WgXcQ"
                    title="Student Success Stories"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  ></iframe>
                </div>
                <div className="p-4 sm:p-6">
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2">
                    Student Success Stories
                  </h3>
                  <p className="text-sm sm:text-base text-gray-600">
                    Hear from our graduates about their learning experience
                  </p>
                </div>
              </div>

              {/* Video 3 - Behind the Scenes */}
              <div 
                className="bg-gray-50 rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all"
                data-aos="zoom-in"
                data-aos-delay="300"
              >
                <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                  <iframe
                    className="absolute top-0 left-0 w-full h-full"
                    src="https://www.youtube.com/embed/dQw4w9WgXcQ"
                    title="Behind the Scenes"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  ></iframe>
                </div>
                <div className="p-4 sm:p-6">
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2">
                    Behind the Scenes
                  </h3>
                  <p className="text-sm sm:text-base text-gray-600">
                    See our training facilities and modern vehicles up close
                  </p>
                </div>
              </div>

              {/* Video 4 - Special Promo */}
              <div 
                className="bg-gray-50 rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all"
                data-aos="zoom-in"
                data-aos-delay="450"
              >
                <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                  <iframe
                    className="absolute top-0 left-0 w-full h-full"
                    src="https://www.youtube.com/embed/dQw4w9WgXcQ"
                    title="Special Promotions"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  ></iframe>
                </div>
                <div className="p-4 sm:p-6">
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2">
                    Current Promotions & Events
                  </h3>
                  <p className="text-sm sm:text-base text-gray-600">
                    Check out our latest offers and upcoming events
                  </p>
                </div>
              </div>
            </div>

            <div className="text-center mt-8 sm:mt-12">
              <p className="text-gray-500 text-sm sm:text-base mb-4">
                Experience our professional training methods and modern facilities
              </p>
              <button
                onClick={() => handleNavigate('courses')}
                className="px-6 sm:px-8 py-3 bg-[#2157da] text-white font-semibold rounded-full hover:bg-[#1a3a8a] transition-all shadow-md hover:shadow-lg"
              >
                Enroll Now
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
              onClick={() => handleNavigate('payment')}
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
    </div>
  )
}

export default Home
