import { useState, useEffect } from "react"
import { newsAPI } from "../services/api"

function NewsAndEvents() {
  const [activeTab, setActiveTab] = useState("news")
  const [newsItems, setNewsItems] = useState([])
  const [events, setEvents] = useState([])
  const [promotionalVideos, setPromotionalVideos] = useState([])
  const [selectedVideo, setSelectedVideo] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await newsAPI.getAll()
        if (response.success) {
          const allData = response.news || []

          setEvents(allData.filter(item => item.type === 'Event'))
          setPromotionalVideos(allData.filter(item => item.type === 'Promotional Video'))
          setNewsItems(allData.filter(item => item.type !== 'Event' && item.type !== 'Promotional Video'))
        }
      } catch (error) {
        console.error("Failed to fetch news and events", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const formatDate = (dateString) => {
    if (!dateString) return "Recent"
    return new Date(dateString).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  }

  const formatEventMonth = (dateString) => {
    if (!dateString) return "TBA"
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  }

  const formatEventDay = (dateString) => {
    if (!dateString) return "-"
    return new Date(dateString).getDate().toString()
  }

  const formatEventTime = (dateString) => {
    if (!dateString) return "TBA"
    return new Date(dateString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
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

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative py-20 bg-[#2157da] overflow-hidden">
        <div className="absolute inset-0 opacity-10 text-white flex items-center justify-center font-black text-[20vw] select-none pointer-events-none">
          NEWS
        </div>
        <div className="container mx-auto px-4 relative z-10 text-center">
          <h1 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tight" data-aos="fade-down">
            NEWS & UPDATES
          </h1>
          <p className="text-xl text-blue-100 max-w-2xl mx-auto leading-relaxed" data-aos="fade-up">
            Stay informed with the latest announcements, road safety tips, and school events.
          </p>
        </div>
      </section>

      {/* Content Section */}
      <section className="py-16 md:py-24 bg-gray-50/50">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">

            {/* Tabs */}
            <div className="flex flex-col sm:flex-row justify-center mb-10 sm:mb-16 p-2 bg-white rounded-3xl sm:rounded-[2rem] shadow-xl w-full sm:w-fit mx-auto border border-gray-100 gap-2 overflow-x-auto hide-scrollbar">
              <button
                onClick={() => setActiveTab("news")}
                className={`px-6 sm:px-10 py-3 sm:py-4 rounded-full text-xs sm:text-sm font-black tracking-widest uppercase transition-all whitespace-nowrap ${activeTab === "news" ? "bg-[#2157da] text-white shadow-lg shadow-blue-200" : "text-gray-400 hover:text-gray-900 bg-gray-50/50 sm:bg-transparent"
                  }`}
              >
                Latest News
              </button>
              <button
                onClick={() => setActiveTab("events")}
                className={`px-6 sm:px-10 py-3 sm:py-4 rounded-full text-xs sm:text-sm font-black tracking-widest uppercase transition-all whitespace-nowrap ${activeTab === "events" ? "bg-[#2157da] text-white shadow-lg shadow-blue-200" : "text-gray-400 hover:text-gray-900 bg-gray-50/50 sm:bg-transparent"
                  }`}
              >
                Events
              </button>
              <button
                onClick={() => setActiveTab("videos")}
                className={`px-6 sm:px-10 py-3 sm:py-4 rounded-full text-xs sm:text-sm font-black tracking-widest uppercase transition-all whitespace-nowrap ${activeTab === "videos" ? "bg-[#F3B74C] text-[#1a2d6b] shadow-lg shadow-[#F3B74C]/30" : "text-gray-400 hover:text-[#F3B74C] bg-gray-50/50 sm:bg-transparent"
                  }`}
              >
                Videos
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2157da]"></div>
              </div>
            ) : activeTab === "videos" ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 lg:gap-8">
                {promotionalVideos.length > 0 ? (
                  promotionalVideos.map((video, idx) => (
                    <div
                      key={video.id || idx}
                      className="group relative rounded-2xl overflow-hidden cursor-pointer shadow-xl hover:shadow-2xl hover:shadow-[#F3B74C]/20 transition-all duration-300 hover:-translate-y-1 bg-black"
                      data-aos="fade-up"
                      data-aos-delay={idx * 100}
                      onClick={() => handleVideoClick(video)}
                    >
                      {/* Thumbnail Container */}
                      <div className="relative w-full" style={{ aspectRatio: '9/16' }}>
                        {video.media_url && video.media_url.startsWith('data:video') ? (
                          <video
                            className="absolute top-0 left-0 w-full h-full object-cover pointer-events-none"
                            src={video.media_url}
                            muted
                            playsInline
                            preload="metadata"
                          ></video>
                        ) : (
                          <iframe
                            className="absolute top-0 left-0 w-full h-full pointer-events-none"
                            src={video.media_url || "https://www.youtube.com/embed/dQw4w9WgXcQ"}
                            title={video.title}
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          ></iframe>
                        )}

                        {/* Dark gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent group-hover:from-black/60 transition-all duration-300"></div>

                        {/* Play Button */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-[#F3B74C] rounded-full flex items-center justify-center shadow-lg shadow-[#F3B74C]/40 transform group-hover:scale-110 transition-all duration-300">
                            <svg className="w-5 h-5 sm:w-8 sm:h-8 text-[#1a2d6b] ml-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>

                        {/* Title logic inside card */}
                        <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-5">
                          <h3 className="text-white font-bold text-sm sm:text-lg leading-tight line-clamp-2 drop-shadow-md">
                            {video.title}
                          </h3>
                          {video.description && (
                            <p className="text-blue-200 text-xs sm:text-sm mt-1 sm:mt-2 line-clamp-1 sm:line-clamp-2 drop-shadow">
                              {video.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full text-center py-12 text-gray-500">No videos available at the moment.</div>
                )}
              </div>
            ) : activeTab === "news" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                {newsItems.length > 0 ? (
                  newsItems.map((item, idx) => (
                    <div key={item.id || idx} className="group bg-white rounded-3xl sm:rounded-[2.5rem] overflow-hidden shadow-lg hover:shadow-xl border border-gray-100/50 hover:-translate-y-2 transition-all duration-500 flex flex-col" data-aos="fade-up" data-aos-delay={Math.min(idx * 100, 300)}>
                      <div className="h-48 sm:h-64 bg-gray-200 overflow-hidden relative shrink-0">
                        <img src={item.media_url || "/images/slider1.png"} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt={item.title} />
                        <div className="absolute top-4 left-4 sm:top-6 sm:left-6">
                          <span className="bg-white/95 backdrop-blur px-3 py-1 sm:px-4 sm:py-1.5 rounded-full text-[9px] sm:text-[10px] font-black text-[#2157da] tracking-widest uppercase shadow-md">
                            {item.type || 'News'}
                          </span>
                        </div>
                      </div>
                      <div className="p-6 sm:p-8 flex flex-col flex-grow">
                        <p className="text-[10px] sm:text-xs font-bold text-gray-400 mb-2 sm:mb-3">{formatDate(item.published_at || item.created_at)}</p>
                        <h3 className="text-lg sm:text-xl font-black text-gray-900 mb-3 sm:mb-4 line-clamp-2 group-hover:text-[#2157da] transition-colors leading-tight min-h-[3rem]">{item.title}</h3>
                        <p className="text-gray-500 text-xs sm:text-sm leading-relaxed mb-6 sm:mb-8 line-clamp-3 flex-grow">{item.description || item.content}</p>
                        <button className="flex items-center gap-2 text-[#2157da] font-black text-[10px] sm:text-xs tracking-widest uppercase group/btn mt-auto">
                          Read Story
                          <div className="w-4 sm:w-6 h-[1px] lg:h-[2px] bg-[#2157da] group-hover/btn:w-8 sm:group-hover/btn:w-10 transition-all"></div>
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full text-center py-12 text-gray-500">No news available at the moment.</div>
                )}
              </div>
            ) : (
              <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
                {events.length > 0 ? (
                  events.map((event, idx) => (
                    <div key={event.id || idx} className="bg-white p-6 sm:p-8 md:p-10 rounded-3xl sm:rounded-[2.5rem] shadow-lg hover:shadow-xl border border-gray-100 flex flex-col md:flex-row gap-6 sm:gap-8 items-center transition-all" data-aos="fade-up" data-aos-delay={Math.min(idx * 100, 300)}>
                      <div className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 bg-blue-50/80 rounded-2xl sm:rounded-[2rem] flex flex-col items-center justify-center shrink-0 border border-blue-100/50 shadow-inner group-hover:bg-[#2157da]/5 transition-colors">
                        <span className="text-2xl sm:text-3xl font-black text-[#2157da] leading-none mb-1">{formatEventDay(event.published_at || event.created_at)}</span>
                        <span className="text-[9px] sm:text-[10px] font-black text-blue-400 tracking-widest uppercase">{formatEventMonth(event.published_at || event.created_at)}</span>
                      </div>
                      <div className="flex-grow text-center md:text-left">
                        <h3 className="text-xl sm:text-2xl font-black text-gray-900 mb-2 sm:mb-3 leading-tight">{event.title}</h3>
                        <div className="flex flex-wrap justify-center md:justify-start gap-3 sm:gap-4 mb-3 sm:mb-4">
                          <span className="text-[10px] sm:text-xs font-bold text-gray-500 flex items-center gap-1.5 sm:gap-2 bg-gray-50 px-3 py-1 rounded-full">
                            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                            {formatEventTime(event.published_at || event.created_at)}
                          </span>
                          <span className="text-[10px] sm:text-xs font-bold text-gray-500 flex items-center gap-1.5 sm:gap-2 bg-gray-50 px-3 py-1 rounded-full text-left">
                            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                            <span className="line-clamp-1 max-w-[120px] sm:max-w-none">{event.tag || 'Master Driving School'}</span>
                          </span>
                        </div>
                        <p className="text-gray-500 text-xs sm:text-sm leading-relaxed max-w-2xl mx-auto md:mx-0">{event.description || event.content}</p>
                      </div>
                      <button className="w-full md:w-auto px-6 sm:px-8 py-3.5 sm:py-4 bg-gray-900 text-white rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-[11px] tracking-widest uppercase hover:bg-[#2157da] transition-all shadow-lg hover:shadow-xl shadow-gray-200 shrink-0">
                        Join Event
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-gray-500">No upcoming events listed.</div>
                )}
              </div>
            )}

            {/* Newsletter Shortcut */}
            <div className="mt-20 bg-gray-900 p-12 md:p-20 rounded-[4rem] text-center relative overflow-hidden" data-aos="zoom-in">
              <div className="absolute top-0 left-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
              <div className="relative z-10">
                <h2 className="text-3xl md:text-4xl font-black text-white mb-6">Never miss an update.</h2>
                <p className="text-white/60 mb-10 max-w-lg mx-auto leading-relaxed">Join our mailing list to get the latest driving tips and promo announcements directly in your inbox.</p>
                <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
                  <input type="text" placeholder="Your email address" className="flex-grow bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                  <button className="bg-white text-gray-900 px-8 py-4 rounded-2xl font-black text-xs tracking-widest uppercase hover:bg-blue-400 transition-all shadow-xl shadow-white/5">
                    Subscribe
                  </button>
                </div>
              </div>
            </div>

          </div>
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
    </div>
  )
}

export default NewsAndEvents
