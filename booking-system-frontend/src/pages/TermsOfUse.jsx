function TermsOfUse() {
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
            TERMS OF USE
          </h1>
          <p className="text-xl text-blue-100 max-w-2xl mx-auto leading-relaxed" data-aos="fade-up">
            Last Updated: February 5, 2026
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-16 md:py-24 bg-gray-50/50">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="bg-white p-8 md:p-16 rounded-[2.5rem] shadow-2xl border border-gray-100 relative" data-aos="fade-up">
              
              <div className="prose prose-blue max-w-none">
                <p className="text-xl text-gray-600 mb-12 leading-relaxed italic border-l-4 border-[#2157da] pl-6 font-medium">
                  Please read these Terms of Use carefully before using this website. Using this website means you have read, understood, and accepted these Terms of Use. If you do not accept these Terms of Use, do not use this website.
                </p>

                <div className="space-y-16">
                  <section>
                    <h2 className="text-3xl font-black text-gray-900 mb-6 uppercase tracking-tight flex items-center gap-4">
                      <span className="w-10 h-10 bg-blue-100 text-[#2157da] rounded-xl flex items-center justify-center text-xl">01</span>
                      Changes to Terms
                    </h2>
                    <p className="text-gray-600 text-lg leading-relaxed">
                      Master Driving School reserves the right to change this Terms of Use from time to time, in whole or in part, without notice to you. You should check back often so you are aware of your current rights and responsibilities. Your continued use of this website after changes to the Terms of Use have been published constitutes your binding acceptance of the updated Terms of Use.
                    </p>
                  </section>

                  <section>
                    <h2 className="text-3xl font-black text-gray-900 mb-6 uppercase tracking-tight flex items-center gap-4">
                      <span className="w-10 h-10 bg-blue-100 text-[#2157da] rounded-xl flex items-center justify-center text-xl">02</span>
                      Trademarks
                    </h2>
                    <p className="text-gray-600 text-lg leading-relaxed">
                      The trademarks, logos, and service marks displayed on this website are the property of Master Driving School or their respective owners. You are not permitted to use these items without the prior written consent of Master Driving School or their respective owners.
                    </p>
                  </section>

                  <section>
                    <h2 className="text-3xl font-black text-gray-900 mb-6 uppercase tracking-tight flex items-center gap-4">
                      <span className="w-10 h-10 bg-blue-100 text-[#2157da] rounded-xl flex items-center justify-center text-xl">03</span>
                      Copyrights
                    </h2>
                    <div className="bg-gray-50 p-8 rounded-3xl border border-gray-100 mb-6 text-lg">
                      <p className="text-gray-700 font-bold mb-4 italic underline decoration-blue-500 underline-offset-4">
                        Master Driving School authorizes you to display on your computer, download, or print the pages from this website provided:
                      </p>
                      <ul className="grid md:grid-cols-2 gap-4 mt-6">
                        {[
                          "The copyright notice appears on all printouts.",
                          "The information is intact and will not be altered.",
                          "Personal, educational, or non-commercial use only.",
                          "No redistribution to any other media."
                        ].map((item, i) => (
                          <li key={i} className="flex items-start gap-3 text-gray-600">
                            <span className="mt-1 text-green-500">
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            </span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </section>

                  <section>
                    <h2 className="text-3xl font-black text-gray-900 mb-6 uppercase tracking-tight flex items-center gap-4">
                      <span className="w-10 h-10 bg-blue-100 text-[#2157da] rounded-xl flex items-center justify-center text-xl">04</span>
                      Disclaimer
                    </h2>
                    <div className="bg-amber-50 p-8 rounded-3xl border-2 border-amber-200">
                      <div className="flex items-center gap-3 text-amber-800 mb-4">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <h3 className="text-xl font-black">IMPORTANT NOTICE</h3>
                      </div>
                      <p className="text-amber-900 text-lg leading-relaxed font-medium">
                        This website and all content are provided on an \"as is\" and \"as available\" basis. Master Driving School makes no warranties or representations, expressed or implied, as to the functionality or usefulness of this website or any content.
                      </p>
                    </div>
                  </section>

                  <section>
                    <h2 className="text-3xl font-black text-gray-900 mb-6 uppercase tracking-tight flex items-center gap-4">
                      <span className="w-10 h-10 bg-blue-100 text-[#2157da] rounded-xl flex items-center justify-center text-xl">05</span>
                      Contact Us
                    </h2>
                    <div className="grid md:grid-cols-2 gap-8">
                      <div className="p-8 bg-blue-50 rounded-3xl border border-blue-100">
                        <h4 className="font-black text-blue-900 mb-4 flex items-center gap-3">
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                            <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                          </svg>
                          SUPPORT EMAIL
                        </h4>
                        <p className="text-[#2157da] font-bold text-lg select-all">masterdrivingmain@gmail.com</p>
                      </div>
                      <div className="p-8 bg-indigo-50 rounded-3xl border border-indigo-100">
                        <h4 className="font-black text-indigo-900 mb-4 flex items-center gap-3">
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 005.47 5.47l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                          </svg>
                          PHONE SUPPORT
                        </h4>
                        <p className="text-indigo-600 font-bold text-lg select-all">+63 915 644 9441</p>
                      </div>
                    </div>
                  </section>
                </div>
              </div>

              <div className="mt-16 pt-8 border-t border-gray-100 text-center">
                <p className="text-gray-400 font-medium italic">
                  Thank you for choosing Master Driving School for your journey.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default TermsOfUse
