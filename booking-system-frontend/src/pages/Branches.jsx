import { useState, useEffect } from 'react'
import { branchesAPI } from '../services/api'

function Branches({ setCurrentPage, isLoggedIn, setPreSelectedBranch }) {
  const [selectedMapUrl, setSelectedMapUrl] = useState('https://www.google.com/maps?q=Metro+Manila,+Philippines&output=embed')
  const [selectedBranch, setSelectedBranch] = useState(null)
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const response = await branchesAPI.getAll()
        if (response.success) {
          // Format branches to match current UI and constraints
          const formattedBranches = response.branches.map(branch => ({
            ...branch,
            phone: branch.contact_number, // map contact_number to phone
            hours: '8:00 AM - 5:00 PM', // maintain fixed hours
            isMain: branch.name.toLowerCase().includes('main branch'),
            // Construct embedUrl from address
            embedUrl: `https://www.google.com/maps?q=${encodeURIComponent(branch.address)}&output=embed`
          }))
          setBranches(formattedBranches)
        }
      } catch (error) {
        console.error('Error fetching branches:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchBranches()
  }, [])

  const handleEnrollNow = (branch) => {
    if (!isLoggedIn) {
      setCurrentPage('signin')
      return
    }
    setPreSelectedBranch(branch)
    setCurrentPage('courses')
  }

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
          {loading ? (
            <div className="col-span-full text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[#2157da] border-t-transparent mb-4"></div>
              <p className="text-gray-600">Loading branches...</p>
            </div>
          ) : branches.length > 0 ? (
            branches.map((branch, index) => (
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
                    onClick={() => handleEnrollNow(branch)}
                    className="flex-1 py-2.5 sm:py-3 bg-[#2157da] text-white rounded-full font-semibold hover:bg-[#1a3a8a] transition-colors text-sm sm:text-base"
                  >
                    Enroll Now
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-12">
              <p className="text-gray-600">No branches found.</p>
            </div>
          )}
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
