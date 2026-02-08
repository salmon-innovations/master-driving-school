import { useState } from "react"

function NewsAndEvents() {
  const [activeTab, setActiveTab] = useState("news")

  const newsItems = [
    {
      id: 1,
      title: "New Branch Opening in Quezon City",
      date: "February 1, 2026",
      category: "Announcement",
      image: "/images/slider1.png",
      excerpt: "We are excited to announce the opening of our newest branch in Quezon City, bringing quality driving education closer to you.",
      content: "Master Driving School is proud to announce the grand opening of our newest branch in Quezon City. This state-of-the-art facility features modern training vehicles and experienced instructors ready to help you master the art of driving."
    },
    {
      id: 2,
      title: "Special Discount for Students",
      date: "January 28, 2026",
      category: "Promo",
      image: "/images/slider2.jpg",
      excerpt: "Get 20% off on all driving courses! Limited time offer for students with valid IDs.",
      content: "We believe in supporting education at every level. Students with valid school IDs can now enjoy a 20% discount on all our driving courses. This is our way of helping the youth prepare for their future on the road."
    },
    {
      id: 3,
      title: "Updated Safety Protocols",
      date: "January 15, 2026",
      category: "Update",
      image: "/images/slider3.jpg",
      excerpt: "We have implemented enhanced safety measures to ensure the well-being of all our students and instructors.",
      content: "The safety of our students and staff is our top priority. We have updated our safety protocols to include enhanced vehicle sanitization, mandatory health checks, and improved training procedures aligned with the latest LTO guidelines."
    }
  ]

  const events = [
    {
      id: 1,
      title: "Defensive Driving Workshop",
      date: "Feb 15, 2026",
      time: "9:00 AM",
      location: "Manila Branch",
      description: "Join us for a comprehensive defensive driving workshop. Learn advanced techniques to handle road emergencies.",
      status: "Upcoming"
    },
    {
      id: 2,
      title: "Road Safety Seminar",
      date: "Feb 20, 2026",
      time: "2:00 PM",
      location: "Makati Branch",
      description: "A free seminar on road safety rules and regulations. Perfect for new drivers and license applicants.",
      status: "Upcoming"
    }
  ]

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
            <div className="flex justify-center mb-16 p-2 bg-white rounded-[2rem] shadow-xl w-fit mx-auto border border-gray-100">
               <button 
                onClick={() => setActiveTab("news")}
                className={`px-10 py-4 rounded-full text-sm font-black tracking-widest uppercase transition-all ${
                  activeTab === "news" ? "bg-[#2157da] text-white shadow-lg shadow-blue-200" : "text-gray-400 hover:text-gray-900"
                }`}
               >
                 Latest News
               </button>
               <button 
                onClick={() => setActiveTab("events")}
                className={`px-10 py-4 rounded-full text-sm font-black tracking-widest uppercase transition-all ${
                  activeTab === "events" ? "bg-[#2157da] text-white shadow-lg shadow-blue-200" : "text-gray-400 hover:text-gray-900"
                }`}
               >
                 Events
               </button>
            </div>

            {activeTab === "news" ? (
              <div className="grid md:grid-cols-3 gap-8">
                {newsItems.map((item, idx) => (
                  <div key={idx} className="group bg-white rounded-[2.5rem] overflow-hidden shadow-xl border border-gray-100 hover:-translate-y-2 transition-all duration-500" data-aos="fade-up" data-aos-delay={idx * 100}>
                    <div className="h-64 bg-gray-200 overflow-hidden relative">
                      <img src={item.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={item.title} />
                      <div className="absolute top-6 left-6">
                        <span className="bg-white/90 backdrop-blur px-4 py-1.5 rounded-full text-[10px] font-black text-[#2157da] tracking-widest uppercase shadow-lg">
                          {item.category}
                        </span>
                      </div>
                    </div>
                    <div className="p-8">
                      <p className="text-xs font-bold text-gray-400 mb-3">{item.date}</p>
                      <h3 className="text-xl font-black text-gray-900 mb-4 h-14 line-clamp-2 group-hover:text-[#2157da] transition-colors">{item.title}</h3>
                      <p className="text-gray-500 text-sm leading-relaxed mb-8 line-clamp-3">{item.excerpt}</p>
                      <button className="flex items-center gap-2 text-[#2157da] font-black text-xs tracking-widest uppercase group/btn">
                        Read Story
                        <div className="w-6 h-[1px] bg-[#2157da] group-hover/btn:w-10 transition-all"></div>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="max-w-4xl mx-auto space-y-6">
                {events.map((event, idx) => (
                  <div key={idx} className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-xl border border-gray-100 flex flex-col md:flex-row gap-8 items-center" data-aos="fade-up">
                    <div className="w-full md:w-32 h-32 bg-blue-50 rounded-[2rem] flex flex-col items-center justify-center shrink-0 border border-blue-100 shadow-inner">
                       <span className="text-3xl font-black text-[#2157da]">{event.date.split(" ")[1].replace(",","")}</span>
                       <span className="text-[10px] font-black text-blue-400 tracking-widest uppercase">{event.date.split(" ")[0]}</span>
                    </div>
                    <div className="flex-grow text-center md:text-left">
                       <h3 className="text-2xl font-black text-gray-900 mb-2">{event.title}</h3>
                       <div className="flex flex-wrap justify-center md:justify-start gap-4 mb-4">
                          <span className="text-xs font-bold text-gray-400 flex items-center gap-2">
                             <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                             {event.time}
                          </span>
                          <span className="text-xs font-bold text-gray-400 flex items-center gap-2">
                             <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                             {event.location}
                          </span>
                       </div>
                       <p className="text-gray-500 text-sm leading-relaxed">{event.description}</p>
                    </div>
                    <button className="px-8 py-4 bg-gray-900 text-white rounded-2xl font-black text-[10px] tracking-widest uppercase hover:bg-[#2157da] transition-all shadow-xl shadow-gray-200 shrink-0">
                      Join Event
                    </button>
                  </div>
                ))}
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
    </div>
  )
}

export default NewsAndEvents
