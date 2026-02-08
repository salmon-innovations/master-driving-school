import { useState } from 'react'

function Branches({ setCurrentPage }) {
  const [selectedMapUrl, setSelectedMapUrl] = useState('https://www.google.com/maps?q=Metro+Manila,+Philippines&output=embed')
  const [selectedBranch, setSelectedBranch] = useState(null)

  const branches = [
    {
      name: 'Master Driving School V-luna Main Branch',
      address: 'Unit 205-206 V-luna cor East Ave, Brgy Pinyahan, Quezon City',
      phone: '0915 644 9441',
      hours: '8:00 AM - 5:00 PM',
      isMain: true,
      mapUrl: 'https://www.google.com/maps/search/?api=1&query=Unit+205-206+V-luna+cor+East+Ave+Brgy+Pinyahan+Quezon+City',
      embedUrl: 'https://www.google.com/maps?q=Unit+205-206+V-luna+cor+East+Ave+Brgy+Pinyahan+Quezon+City&output=embed'
    },
    {
      name: 'Master Driving School Antipolo Branch',
      address: 'Ellimac Building, Puregold Circumferential Road, San Roque, Antipolo City',
      phone: '0967 427 0198',
      hours: '8:00 AM - 5:00 PM',
      mapUrl: 'https://www.google.com/maps/search/?api=1&query=Ellimac+Building+Puregold+Circumferential+Road+San+Roque+Antipolo+City',
      embedUrl: 'https://www.google.com/maps?q=Ellimac+Building+Puregold+Circumferential+Road+San+Roque+Antipolo+City&output=embed'
    },
    {
      name: 'Master Driving School Mandaluyong Branch',
      address: 'ACME Bldg. 373 Boni Avenue, Brgy. Malamig, Mandaluyong City',
      phone: '0906 450 5197 / 0962 134 7068',
      hours: '8:00 AM - 5:00 PM',
      mapUrl: 'https://www.google.com/maps/search/?api=1&query=ACME+Bldg+373+Boni+Avenue+Brgy+Malamig+Mandaluyong+City',
      embedUrl: 'https://www.google.com/maps?q=ACME+Bldg+373+Boni+Avenue+Brgy+Malamig+Mandaluyong+City&output=embed'
    },
    {
      name: 'Master Driving School Marikina Branch',
      address: '374 JP Rizal St., Marikina City',
      phone: '0966 291 4687 / 0996 084 5626',
      hours: '8:00 AM - 5:00 PM',
      mapUrl: 'https://www.google.com/maps/search/?api=1&query=374+JP+Rizal+St+Marikina+City',
      embedUrl: 'https://www.google.com/maps?q=374+JP+Rizal+St+Marikina+City&output=embed'
    },
    {
      name: 'Master Driving School Pasig Branch',
      address: '9001 Felix Ave. Cor. Jasmin St. Pasig City',
      phone: '0945 834 4002 / 0969 632 5887',
      hours: '8:00 AM - 5:00 PM',
      mapUrl: 'https://www.google.com/maps/search/?api=1&query=9001+Felix+Ave+Cor+Jasmin+St+Pasig+City',
      embedUrl: 'https://www.google.com/maps?q=9001+Felix+Ave+Cor+Jasmin+St+Pasig+City&output=embed'
    },
    {
      name: 'Master Prime Driving School Meycauayan Branch',
      address: 'UNIT A1-B2, JRJ BUILDING, Barangay, CAMALIG, Meycauayan, 3020 Bulacan',
      phone: '0945 461 5171 / 0962 058 4898',
      hours: '8:00 AM - 5:00 PM',
      mapUrl: 'https://maps.app.goo.gl/QbkZ8FGjK5HdEEzab',
      embedUrl: 'https://www.google.com/maps?q=14.730588,120.961892&output=embed'
    },
    {
      name: 'Master Driving School Malabon Branch',
      address: '2nd Floor RLN Centre, Gov Pascual, Malabon City',
      phone: '0961 807 3526 / 0926 693 7265',
      hours: '8:00 AM - 5:00 PM',
      mapUrl: 'https://www.google.com/maps/search/?api=1&query=2nd+Floor+RLN+Centre+Gov+Pascual+Malabon+City',
      embedUrl: 'https://www.google.com/maps?q=2nd+Floor+RLN+Centre+Gov+Pascual+Malabon+City&output=embed'
    },
    {
      name: 'Masters Prime Holdings Corp. Binan Branch',
      address: "San Antonio Nat'l Hi-way, Binan, Laguna",
      phone: '0912 595 2830',
      hours: '8:00 AM - 5:00 PM',
      mapUrl: 'https://www.google.com/maps/search/?api=1&query=San+Antonio+National+Highway+Binan+Laguna',
      embedUrl: 'https://www.google.com/maps?q=San+Antonio+National+Highway+Binan+Laguna&output=embed'
    },
    {
      name: 'Master Prime Holdings Corp. Las Piñas Branch',
      address: 'KM21 Alabang Zapote Road, Almanza Uno, Las Piñas City (beside SM South Mall infront of Almanza Uno Brgy Hall)',
      phone: '0908 388 9144',
      hours: '8:00 AM - 5:00 PM',
      mapUrl: 'https://www.google.com/maps/search/?api=1&query=KM21+Alabang+Zapote+Road+Almanza+Uno+Las+Pinas+City',
      embedUrl: 'https://www.google.com/maps?q=KM21+Alabang+Zapote+Road+Almanza+Uno+Las+Pinas+City&output=embed'
    },
    {
      name: 'Master Prime Driving School Bacoor Branch',
      address: '2nd Floor SICI Cavite Business Center Lot 4A Aguinaldo Highway, Habay 1, Bacoor, Cavite',
      phone: '0954 184 2771 / 0968 365 9492',
      hours: '8:00 AM - 5:00 PM',
      mapUrl: 'https://www.google.com/maps/search/?api=1&query=SICI+Cavite+Business+Center+Aguinaldo+Highway+Habay+1+Bacoor+Cavite',
      embedUrl: 'https://www.google.com/maps?q=SICI+Cavite+Business+Center+Aguinaldo+Highway+Habay+1+Bacoor+Cavite&output=embed'
    },
    {
      name: 'Master Driving School San Mateo Branch',
      address: '101 General Luna St. Ampid I, San Mateo, Rizal',
      phone: '0966 288 6010',
      hours: '8:00 AM - 5:00 PM',
      mapUrl: 'https://maps.app.goo.gl/daY3xEr7lqZeoGQmz',
      embedUrl: 'https://www.google.com/maps?q=14.698147,121.122633&output=embed'
    },
    {
      name: 'Master Driving School Valenzuela Branch',
      address: '304 McArthur Hi-way, Malinta, Valenzuela City',
      phone: '0953 284 8563',
      hours: '8:00 AM - 5:00 PM',
      mapUrl: 'https://www.google.com/maps/search/?api=1&query=304+McArthur+Highway+Malinta+Valenzuela+City',
      embedUrl: 'https://www.google.com/maps?q=304+McArthur+Highway+Malinta+Valenzuela+City&output=embed'
    },
    {
      name: 'Master Driving School Bocaue Bulacan Branch',
      address: '1594 McArthur Hi-way, Lolomboy, Bocaue, Bulacan',
      phone: '0945 461 5171',
      hours: '8:00 AM - 5:00 PM',
      mapUrl: 'https://www.google.com/maps/search/?api=1&query=1594+McArthur+Highway+Lolomboy+Bocaue+Bulacan',
      embedUrl: 'https://www.google.com/maps?q=1594+McArthur+Highway+Lolomboy+Bocaue+Bulacan&output=embed'
    }
  ]

  const handleGetDirections = (embedUrl, index) => {
    setSelectedMapUrl(embedUrl)
    setSelectedBranch(index)
    // Scroll to map
    document.getElementById('branch-map')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div className="py-12 sm:py-16 lg:py-20 bg-gray-50 min-h-[calc(100vh-4rem)] w-full">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8 sm:mb-12">
          <h1 
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#2157da] mb-3 sm:mb-4"
            data-aos="fade-up"
            data-aos-duration="400"
          >
            Our Branches
          </h1>
          <p 
            className="text-sm sm:text-base text-gray-600 max-w-2xl mx-auto px-4"
            data-aos="fade-up"
            data-aos-duration="500"
          >
            Find a Master Driving School location near you
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 max-w-6xl mx-auto">
          {branches.map((branch, index) => (
            <div
              key={index}
              className={`bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all p-6 sm:p-8 flex flex-col h-full ${
                selectedBranch === index ? 'ring-2 sm:ring-4 ring-[#F3B74C]' : ''
              }`}
              data-aos="fade-up"
              data-aos-duration="400"
            >
              <div className="h-8 mb-3 sm:mb-4">
                {branch.isMain && (
                  <div className="inline-block bg-[#F3B74C] text-[#2157da] px-3 sm:px-4 py-1 rounded-full text-xs sm:text-sm font-semibold">
                    Main Branch
                  </div>
                )}
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-[#2157da] mb-3 sm:mb-4">
                {branch.name}
              </h3>
              <div className="space-y-2 sm:space-y-3 text-gray-700 flex-grow">
                <div className="flex items-start">
                  <span className="text-lg sm:text-xl mr-2 sm:mr-3 flex-shrink-0">📍</span>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm sm:text-base">Address</p>
                    <p className="text-xs sm:text-sm">{branch.address}</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <span className="text-lg sm:text-xl mr-2 sm:mr-3 flex-shrink-0">📞</span>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm sm:text-base">Phone</p>
                    <p className="text-xs sm:text-sm">{branch.phone}</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <span className="text-lg sm:text-xl mr-2 sm:mr-3 flex-shrink-0">🕐</span>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm sm:text-base">Hours</p>
                    <p className="text-xs sm:text-sm">{branch.hours}</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 sm:gap-3 mt-4 sm:mt-6">
                <button
                  onClick={() => handleGetDirections(branch.embedUrl, index)}
                  className="flex-1 py-2.5 sm:py-3 bg-white text-[#2157da] border-2 border-[#2157da] rounded-full font-semibold hover:bg-[#2157da] hover:text-white transition-colors text-sm sm:text-base"
                >
                  Get Directions
                </button>
                <button 
                  onClick={() => setCurrentPage('courses')}
                  className="flex-1 py-2.5 sm:py-3 bg-[#2157da] text-white rounded-full font-semibold hover:bg-[#1a3a8a] transition-colors text-sm sm:text-base"
                >
                  Enroll Now
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Map Section */}
        <div id="branch-map" className="mt-12 sm:mt-16 bg-white rounded-2xl shadow-lg p-6 sm:p-8 max-w-6xl mx-auto" data-aos="fade-up" data-aos-duration="500">
          <h2 className="text-xl sm:text-2xl font-bold text-[#2157da] mb-4 sm:mb-6 text-center">
            Find Us on the Map
          </h2>
          <div className="rounded-xl h-64 sm:h-96 overflow-hidden">
            <iframe
              key={selectedMapUrl}
              src={selectedMapUrl}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen=""
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Master Driving School Locations"
            ></iframe>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Branches
