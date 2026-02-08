import { useState } from "react"
import { useNotification } from "../context/NotificationContext"

function Contact() {
  const { showNotification } = useNotification()
  const [formData, setFormData] = useState({ 
    name: "", 
    email: "", 
    subject: "General Inquiry",
    message: "" 
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    // Simulate API call
    setTimeout(() => {
      showNotification("Thank you! Your message has been sent successfully.", "success")
      setFormData({ name: "", email: "", subject: "General Inquiry", message: "" })
      setLoading(false)
    }, 1500)
  }

  const contactInfo = [
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
      ),
      title: "Call Us",
      details: ["0927-399-3219", "0968-602-7715"],
      color: "bg-blue-50 text-blue-600"
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      title: "Email Us",
      details: ["masterdrivingschool.ph@gmail.com"],
      color: "bg-indigo-50 text-indigo-600"
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      title: "Main Branch",
      details: ["Units 206, PMHA Building, V. Luna, Q.C."],
      color: "bg-emerald-50 text-emerald-600"
    }
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative py-20 bg-[#2157da] overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-white rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2"></div>
        </div>
        
        <div className="container mx-auto px-4 relative z-10 text-center">
          <h1 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tight" data-aos="fade-down">
            CONTACT US
          </h1>
          <p className="text-xl text-blue-100 max-w-2xl mx-auto leading-relaxed" data-aos="fade-up">
            Have questions? We are here to help you start your journey to becoming a master driver.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="flex flex-col lg:flex-row gap-16">
            
            {/* Left: Contact Info Cards */}
            <div className="lg:w-1/3 space-y-6" data-aos="fade-right">
              <h2 className="text-3xl font-bold text-gray-900 mb-8">Informations</h2>
              
              {contactInfo.map((item, idx) => (
                <div key={idx} className="flex gap-6 p-6 bg-gray-50 rounded-3xl border border-gray-100 transition-all hover:shadow-xl hover:bg-white group">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 ${item.color}`}>
                    {item.icon}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
                    {item.details.map((detail, dIdx) => (
                      <p key={dIdx} className="text-gray-600 leading-relaxed font-medium">{detail}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Right: Contact Form */}
            <div className="lg:w-2/3" data-aos="fade-left">
              <div className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-2xl border border-gray-100 relative">
                
                <h2 className="text-3xl font-bold text-gray-900 mb-8">Send us a message</h2>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-500 uppercase tracking-wider ml-1">Full Name</label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-[#2157da] focus:outline-none transition-all placeholder-gray-400 font-medium"
                        placeholder="John Doe"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-500 uppercase tracking-wider ml-1">Email Address</label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-[#2157da] focus:outline-none transition-all placeholder-gray-400 font-medium"
                        placeholder="john@example.com"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 uppercase tracking-wider ml-1">Subject</label>
                    <select 
                      value={formData.subject}
                      onChange={(e) => setFormData({...formData, subject: e.target.value})}
                      className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-[#2157da] focus:outline-none transition-all font-medium appearance-none"
                    >
                      <option>General Inquiry</option>
                      <option>Enrollment Question</option>
                      <option>Branch Information</option>
                      <option>Other</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 uppercase tracking-wider ml-1">Your Message</label>
                    <textarea
                      required
                      rows="5"
                      value={formData.message}
                      onChange={(e) => setFormData({...formData, message: e.target.value})}
                      className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-[#2157da] focus:outline-none transition-all placeholder-gray-400 font-medium resize-none"
                      placeholder="Tell us how we can help you..."
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full md:w-auto px-12 py-5 bg-[#2157da] text-white rounded-2xl font-black text-lg hover:bg-[#1a3a8a] transition-all transform hover:-translate-y-1 shadow-xl hover:shadow-[#2157da]/30 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <span>SEND MESSAGE</span>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Join Section */}
      <section className="pb-24">
        <div className="container mx-auto px-4">
          <div className="bg-[#2157da] p-10 md:p-16 rounded-[3rem] text-center text-white relative overflow-hidden" data-aos="zoom-in">
            <div className="absolute top-0 left-0 w-full h-full bg-[url('/images/pattern.png')] opacity-10"></div>
            <h2 className="text-3xl md:text-4xl font-bold mb-6 relative z-10 text-white">Follow our Facebook Page</h2>
            <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto relative z-10">
              Stay updated with our latest news, events, and driving tips.
            </p>
            <div className="flex justify-center gap-6 relative z-10">
              <button 
                onClick={() => window.open('https://www.facebook.com/masterdrivingschool.ph', '_blank')}
                className="px-10 py-4 bg-white text-[#2157da] rounded-2xl font-bold text-lg hover:bg-blue-50 transition-all flex items-center gap-3 shadow-2xl"
              >
                <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                FACEBOOK
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Contact
