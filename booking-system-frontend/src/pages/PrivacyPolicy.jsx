function PrivacyPolicy() {
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
            PRIVACY POLICY
          </h1>
          <p className="text-xl text-blue-100 max-w-2xl mx-auto leading-relaxed" data-aos="fade-up">
            Your privacy matters. Learn how we protect your data in compliance with the Data Privacy Act of 2012.
          </p>
          <p className="mt-4 text-sm font-bold text-white/50 tracking-widest uppercase">Last Updated: February 5, 2026</p>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-16 md:py-24 bg-gray-50/50">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="bg-white p-8 md:p-16 rounded-[2.5rem] shadow-2xl border border-gray-100 relative" data-aos="fade-up">
              
              <div className="prose prose-blue max-w-none">
                <p className="text-xl text-gray-600 mb-12 leading-relaxed">
                  At <span className="text-[#2157da] font-black">Master Driving School</span>, we are committed to protecting your personal information. This policy outlines our practices regarding data collection, usage, and your rights under the Philippine Data Privacy Act.
                </p>

                <div className="space-y-20">
                  {/* Section 1 */}
                  <section>
                    <h2 className="text-3xl font-black text-gray-900 mb-8 uppercase flex items-center gap-4">
                      <span className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center text-xl shadow-lg shadow-blue-200">01</span>
                      Information We Collect
                    </h2>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="p-8 bg-gray-50 rounded-[2rem] border border-gray-100">
                        <h3 className="text-xl font-black text-gray-800 mb-4">Personal Details</h3>
                        <ul className="space-y-3 text-gray-600 font-medium">
                          <li className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                            Full name, DOB, Age, Gender
                          </li>
                          <li className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                            Email, Phone, Mailing Address
                          </li>
                          <li className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                            Government-Issued IDs (LTO)
                          </li>
                          <li className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                            Emergency Contact Details
                          </li>
                        </ul>
                      </div>
                      <div className="p-8 bg-blue-50/50 rounded-[2rem] border border-blue-100">
                        <h3 className="text-xl font-black text-blue-900 mb-4">Technical Data</h3>
                        <ul className="space-y-3 text-blue-800 font-medium opacity-80">
                          <li className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                            IP Addresses & Location
                          </li>
                          <li className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                            Browser Type & Version
                          </li>
                          <li className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                            Device Information
                          </li>
                          <li className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                            Cookies & Click Patterns
                          </li>
                        </ul>
                      </div>
                    </div>
                  </section>

                  {/* Section 2 */}
                  <section>
                    <h2 className="text-3xl font-black text-gray-900 mb-8 uppercase flex items-center gap-4">
                      <span className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center text-xl shadow-lg shadow-blue-200">02</span>
                      How We Use Data
                    </h2>
                    <div className="bg-[#2157da] p-8 md:p-12 rounded-[2.5rem] text-white">
                      <p className="text-xl mb-8 font-medium opacity-90">We process your data to provide high-quality driving education and maintain safety standards.</p>
                      <ul className="grid md:grid-cols-2 gap-x-12 gap-y-6">
                        {[
                          "Managing enrollment and lesson schedules",
                          "Complying with LTO and regulatory requirements",
                          "Issuing certificates and maintaining records",
                          "Processing secure payments",
                          "Improving our curriculum and instructor performance",
                          "Responding to inquiries and support needs"
                        ].map((text, idx) => (
                          <li key={idx} className="flex items-start gap-4">
                            <div className="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                              </svg>
                            </div>
                            <span className="font-medium">{text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </section>

                  {/* Section 3 */}
                  <section>
                    <h2 className="text-3xl font-black text-gray-900 mb-8 uppercase flex items-center gap-4">
                      <span className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center text-xl shadow-lg shadow-blue-200">03</span>
                      Data Security
                    </h2>
                    <div className="p-8 rounded-[2rem] border-2 border-dashed border-blue-200 bg-white">
                      <p className="text-lg text-gray-600 leading-relaxed mb-6">
                        We implement advanced security protocols to ensure your data stays private and protected from unauthorized access.
                      </p>
                      <div className="flex flex-wrap gap-4">
                        {["SSL Encryption", "Secure Storage", "Access Controls", "Regular Audits", "Staff Training"].map((tag) => (
                          <span key={tag} className="px-6 py-3 bg-blue-50 text-[#2157da] rounded-xl font-black text-sm tracking-wide border border-blue-100">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </section>

                  {/* Section 4 */}
                  <section>
                    <h2 className="text-3xl font-black text-gray-900 mb-8 uppercase flex items-center gap-4">
                      <span className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center text-xl shadow-lg shadow-blue-200">04</span>
                      Your Rights
                    </h2>
                    <div className="space-y-4">
                      {[
                        { title: "Right to be Informed", desc: "Know exactly how your data is collected and used." },
                        { title: "Right to Access", desc: "Request a copy of your personal data at any time." },
                        { title: "Right to Rectification", desc: "Correct any inaccurate or incomplete info." },
                        { title: "Right to Data Portability", desc: "Obtain your data in a clean electronic format." }
                      ].map((right, idx) => (
                        <div key={idx} className="p-6 bg-gray-50 rounded-2xl flex items-center justify-between group hover:bg-white hover:shadow-xl transition-all cursor-default border border-transparent hover:border-blue-100">
                          <div>
                            <h4 className="font-black text-gray-900">{right.title}</h4>
                            <p className="text-gray-500 font-medium">{right.desc}</p>
                          </div>
                          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>

                <div className="mt-20 p-12 bg-gray-900 rounded-[2.5rem] text-white">
                  <h3 className="text-2xl font-black mb-6">Questions? Contact DPO</h3>
                  <div className="flex flex-col md:flex-row gap-8">
                    <div>
                      <p className="text-white/60 uppercase text-xs font-black tracking-widest mb-2">Email Address</p>
                      <p className="text-xl font-bold">masterdrivingmain@gmail.com</p>
                    </div>
                    <div>
                      <p className="text-white/60 uppercase text-xs font-black tracking-widest mb-2">Support Hotline</p>
                      <p className="text-xl font-bold">+63 915 644 9441</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default PrivacyPolicy
