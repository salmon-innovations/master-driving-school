function TermsAndConditions() {
  const categories = [
    {
      id: "01",
      title: "Eligibility",
      items: [
        "Student(s) must be at least 16 years of age with Parent's consent when applying for TDC.",
        "Student(s) must hold a valid Student Permit or valid Driver's License to enroll in any driving course."
      ]
    },
    {
      id: "02",
      title: "Enrollment & Payment",
      items: [
        "Enrollment is only confirmed upon receipt of a completed application form and payment of the course fee.",
        "50% Down payment is acceptable.",
        "Full payment must be made before the 2nd day of lesson.",
        "Payments are NON-REFUNDABLE and NON-TRANSFERABLE unless stated otherwise in the cancellation and refund policy."
      ]
    },
    {
      id: "03",
      title: "Cancellation & Refunds",
      items: [
        "A full refund will be issued if the student cancels enrollment within 5 days before the course start date.",
        "A 5-day notice is required to reschedule a lesson without incurring a fee.",
        "Failure to give proper notice or missed lessons may result in: 1st Reschedule — ₱1,000.00 fee; 2nd Reschedule — Lesson Forfeiture.",
        "Refunds for courses cancelled by the driving school will be issued in full."
      ]
    },
    {
      id: "04",
      title: "Lesson Schedule",
      items: [
        "Lessons are scheduled according to the availability of both the instructor and the student. The school reserves the right to adjust the lesson schedule.",
        "Punctuality is required. Students who arrive late may lose the portion of the lesson missed, and no extra time will be provided."
      ]
    },
    {
      id: "05",
      title: "Student Conduct",
      items: [
        "Students must follow all instructions from the instructor during lessons.",
        "Students are expected to behave responsibly and comply with all traffic laws during lessons.",
        "Use of alcohol, drugs, or any illegal substances before or during lessons is strictly prohibited and will result in termination of enrollment without refund."
      ]
    },
    {
      id: "06",
      title: "Completion of Course",
      items: [
        "The completion of the course and issuance of certificates depend on the student's performance and test result.",
        "The driving school does not guarantee that students will pass their driving test or obtain a driver's license."
      ]
    },
    {
      id: "07",
      title: "Privacy Policy",
      items: [
        "The driving school respects your privacy and is committed to protecting your personal information.",
        "Personal details collected will be kept confidential and used only for course administration and legal purposes."
      ]
    },
    {
      id: "08",
      title: "Amendments",
      items: [
        "The driving school reserves the right to amend these Terms and Conditions at any time.",
        "Any changes will be communicated via phone call or email."
      ]
    },
    {
      id: "09",
      title: "Email Communications",
      items: [
        "By enrolling or creating an account, you agree to receive News, Events, and Promotional emails from Master Driving School.",
        "This applies to all students, including guest students who enroll without creating an account.",
        "You may contact the school to opt out of promotional emails at any time; however, transactional emails (receipts, schedules, verification) will still be sent."
      ]
    }
  ]

  return (
    <div className="min-h-screen bg-white">

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
            Terms &amp; Conditions
          </h1>
          <p className="text-base md:text-lg text-blue-100 max-w-xl mx-auto leading-relaxed" data-aos="fade-up">
            Please review our enrollment and participation guidelines carefully before proceeding.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 bg-white/10 backdrop-blur px-5 py-2 rounded-full border border-white/20" data-aos="fade-up">
            <svg className="w-3.5 h-3.5 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3M3 11h18M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-white font-semibold text-xs tracking-wide">LAST UPDATED: FEBRUARY 5, 2026</span>
          </div>
        </div>
      </section>

      {/* Intro Bar */}
      <div className="bg-white border-b border-gray-100">
        <div className="container mx-auto px-4 py-6">
          <p className="text-center text-gray-500 text-sm md:text-base max-w-3xl mx-auto leading-relaxed">
            These terms and conditions govern the enrollment and participation in driving courses offered by{' '}
            <span className="font-semibold text-gray-700">Master Driving School</span>. By enrolling, you agree to all of the following:
          </p>
        </div>
      </div>

      {/* Terms Grid */}
      <section className="py-12 md:py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-7xl mx-auto">

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {categories.map((cat, idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex flex-col"
                  data-aos="fade-up"
                  data-aos-delay={idx * 60}
                >
                  {/* Card Header */}
                  <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-gray-50">
                    <span className="w-9 h-9 rounded-xl bg-[#2157da] text-white text-sm font-black flex items-center justify-center flex-shrink-0 shadow-sm">
                      {cat.id}
                    </span>
                    <h2 className="text-base font-bold text-gray-900 leading-tight">{cat.title}</h2>
                  </div>
                  {/* Card Body */}
                  <ul className="px-6 py-5 space-y-3 flex-1">
                    {cat.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#2157da] mt-2 flex-shrink-0 opacity-70"></div>
                        <p className="text-gray-600 text-sm leading-relaxed">{item}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Liability Notice */}
            <div className="mt-10 bg-gray-900 rounded-3xl text-white overflow-hidden relative" data-aos="zoom-in">
              <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 w-60 h-60 bg-blue-400/10 rounded-full blur-2xl pointer-events-none"></div>
              <div className="relative z-10 p-8 md:p-12">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-black">Liability &amp; Responsibility</h2>
                </div>
                <div className="grid md:grid-cols-2 gap-8">
                  <p className="text-white/75 text-sm md:text-base leading-relaxed">
                    The driving school is not liable for any damage, injury, or loss incurred during lessons unless caused by negligence on the part of the school or instructor. Students are responsible for any fines, penalties, or legal issues arising from their actions during a lesson (PDC).
                  </p>
                  <p className="text-white/75 text-sm md:text-base leading-relaxed italic border-l-2 border-blue-500 pl-6">
                    "The completion of the course and issuance of certificates depends on student performance. We do not guarantee passing the LTO test, but we promise the best education to get you there."
                  </p>
                </div>
              </div>
            </div>

            {/* Acknowledgement */}
            <div className="mt-10" data-aos="fade-up">
              <div className="p-px bg-gradient-to-r from-[#2157da] to-blue-400 rounded-2xl">
                <div className="bg-white px-8 py-6 rounded-2xl flex flex-col sm:flex-row items-center justify-center gap-3 text-center sm:text-left">
                  <svg className="w-6 h-6 text-[#2157da] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-gray-800 font-bold text-base md:text-lg">
                    By enrolling, you acknowledge that you have read and agreed to all of these terms.
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
