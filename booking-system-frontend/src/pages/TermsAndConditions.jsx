function TermsAndConditions() {
  const categories = [
    {
      id: "01",
      title: "Eligibility",
      items: [
        "Students must be at least 16 years of age (with Parental consent for TDC).",
        "Must hold a valid Student Permit or Driver License for PDC."
      ]
    },
    {
      id: "02",
      title: "Enrollment & Payment",
      items: [
        "Enrollment is confirmed only after application and payment.",
        "50% Downpayment is acceptable to start.",
        "Full payment required before the 2nd day of lessons.",
        "Fees are non-refundable and non-transferrable."
      ]
    },
    {
      id: "03",
      title: "Cancellation & Refunds",
      items: [
        "Full refund if cancelled 5 days before course start.",
        "5 days notice required to reschedule without fees.",
        "Late fees: 1st Reschedule (₱1,000), 2nd (Forfeiture)."
      ]
    },
    {
      id: "04",
      title: "Student Conduct",
      items: [
        "Follow all instructor directions strictly.",
        "Comply with all traffic laws during practical lessons.",
        "Zero tolerance for alcohol or drugs (immediate termination)."
      ]
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
            TERMS & CONDITIONS
          </h1>
          <p className="text-xl text-blue-100 max-w-2xl mx-auto leading-relaxed" data-aos="fade-up">
            Please review our enrollment and participation guidelines carefully.
          </p>
          <div className="mt-8 inline-flex items-center gap-2 bg-white/10 backdrop-blur px-6 py-2 rounded-full border border-white/20">
             <span className="text-white font-bold text-sm">LAST UPDATED: FEBRUARY 5, 2026</span>
          </div>
        </div>
      </section>

      {/* Content Section */}
      <section className="py-16 md:py-24 bg-gray-50/50">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            
            <div className="grid md:grid-cols-2 gap-8">
              {categories.map((cat, idx) => (
                <div key={idx} className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-gray-100 group hover:-translate-y-2 transition-all duration-300" data-aos="fade-up" data-aos-delay={idx * 100}>
                  <div className="flex items-center gap-6 mb-8">
                    <span className="text-5xl font-black text-gray-100 group-hover:text-blue-50 transition-colors">{cat.id}</span>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">{cat.title}</h2>
                  </div>
                  <ul className="space-y-4">
                    {cat.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-4">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2.5 flex-shrink-0"></div>
                        <p className="text-gray-600 font-medium leading-relaxed">{item}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Liability Notice */}
            <div className="mt-12 bg-gray-900 p-10 md:p-16 rounded-[3rem] text-white relative overflow-hidden" data-aos="zoom-in">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl"></div>
              <div className="relative z-10">
                <h2 className="text-3xl font-black mb-6">Liability & Responsibility</h2>
                <div className="grid md:grid-cols-2 gap-12">
                  <p className="text-lg text-white/80 leading-relaxed">
                    The driving school is not liable for any damage, injury, or loss incurred during lessons unless caused by gross negligence. Students are responsible for any fines or penalties arising from their actions during PDC.
                  </p>
                  <p className="text-lg text-white/80 leading-relaxed italic border-l-2 border-blue-500 pl-8">
                    "The completion of the course and issuance of certificates depends on student performance. We do not guarantee passing the LTO test, but we promise the best education to get you there."
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom Acknowledgement */}
            <div className="mt-12 text-center" data-aos="fade-up">
              <div className="inline-block p-1 bg-gradient-to-r from-[#2157da] to-blue-400 rounded-3xl">
                <div className="bg-white px-10 py-6 rounded-[1.4rem]">
                  <p className="text-gray-900 font-black text-lg">
                    By enrolling, you acknowledge that you have read and agreed to these terms.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>
    </div>
  )
}

export default TermsAndConditions
