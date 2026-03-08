function TermsOfUse() {
  const sections = [
    {
      id: "01",
      title: "Changes to Terms",
      items: [
        "Master Driving School reserves the right to change these Terms of Use at any time, in whole or in part, without notice.",
        "You should check back regularly to stay aware of your current rights and responsibilities.",
        "Continued use of this website after changes are published constitutes your binding acceptance of the updated Terms."
      ]
    },
    {
      id: "02",
      title: "Trademarks",
      items: [
        "All trademarks, logos, and service marks on this website are the property of Master Driving School or their respective owners.",
        "You are not permitted to use these items without prior written consent from Master Driving School or the respective owners."
      ]
    },
    {
      id: "03",
      title: "Copyrights",
      items: [
        "You may display, download, or print pages from this website for personal, educational, or non-commercial use only.",
        "The copyright notice must appear on all printouts.",
        "Content must remain intact and may not be altered.",
        "Redistribution to any other media is strictly prohibited."
      ]
    },
    {
      id: "04",
      title: "Disclaimer",
      items: [
        "This website and all its content are provided on an \"as is\" and \"as available\" basis.",
        "Master Driving School makes no warranties or representations, expressed or implied, regarding the functionality or usefulness of this website or any of its content."
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="relative py-16 md:py-24 bg-[#2157da] overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-white rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2"></div>
        </div>
        <div className="container mx-auto px-4 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur px-4 py-1.5 rounded-full border border-white/20 mb-6" data-aos="fade-down">
            <span className="text-white/80 text-xs font-semibold tracking-widest uppercase">Legal Document</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tight" data-aos="fade-down">
            TERMS OF USE
          </h1>
          <p className="text-base md:text-lg text-blue-100 max-w-xl mx-auto leading-relaxed" data-aos="fade-up">
            Rules and guidelines governing your use of the Master Driving School website.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 bg-white/10 backdrop-blur px-5 py-2 rounded-full border border-white/20" data-aos="fade-up">
            <svg className="w-3.5 h-3.5 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-white font-semibold text-xs tracking-wide">LAST UPDATED: FEBRUARY 5, 2026</span>
          </div>
        </div>
      </section>

      {/* Intro Bar */}
      <div className="bg-white border-b border-gray-100">
        <div className="container mx-auto px-4 py-6">
          <p className="text-center text-gray-500 text-sm md:text-base max-w-3xl mx-auto leading-relaxed">
            Please read these Terms of Use carefully before using this website. Using this website means you have read, understood, and accepted these terms. If you do not accept these Terms of Use, please do not use this website.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <section className="py-12 md:py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-7xl mx-auto">

            {/* Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {sections.map((section, idx) => (
                <div
                  key={section.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex flex-col"
                  data-aos="fade-up"
                  data-aos-delay={idx * 60}
                >
                  <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-gray-50">
                    <span className="w-9 h-9 rounded-xl bg-[#2157da] text-white text-sm font-black flex items-center justify-center flex-shrink-0 shadow-sm">
                      {section.id}
                    </span>
                    <h2 className="text-base font-bold text-gray-900 leading-tight">{section.title}</h2>
                  </div>
                  <ul className="px-6 py-5 space-y-3 flex-1">
                    {section.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#2157da] mt-2 flex-shrink-0 opacity-70"></div>
                        <p className="text-gray-600 text-sm leading-relaxed">{item}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Contact Us Section */}
            <div className="mt-10 bg-gray-900 rounded-3xl text-white overflow-hidden relative" data-aos="zoom-in">
              <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 w-60 h-60 bg-blue-400/10 rounded-full blur-2xl pointer-events-none"></div>
              <div className="relative z-10 p-8 md:p-12">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                      <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-black">Contact Us</h2>
                </div>
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <p className="text-white/50 uppercase text-xs font-black tracking-widest mb-2">Support Email</p>
                    <p className="text-white/90 text-lg font-bold">masterdrivingmain@gmail.com</p>
                  </div>
                  <div>
                    <p className="text-white/50 uppercase text-xs font-black tracking-widest mb-2">Phone Support</p>
                    <p className="text-white/90 text-lg font-bold">+63 915 644 9441</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Acknowledgement */}
            <div className="mt-10" data-aos="fade-up">
              <div className="p-px bg-gradient-to-r from-[#2157da] to-blue-400 rounded-2xl">
                <div className="bg-white px-8 py-6 rounded-2xl flex flex-col sm:flex-row items-center justify-center gap-3 text-center sm:text-left">
                  <svg className="w-6 h-6 text-[#2157da] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-gray-800 font-bold text-base md:text-lg">
                    By continuing to use this website, you acknowledge and agree to these Terms of Use.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>
    </div>
  );
}

export default TermsOfUse;
