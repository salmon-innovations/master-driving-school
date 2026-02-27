import { useState, useEffect } from 'react'
import { useNotification } from '../context/NotificationContext'
import { coursesAPI, branchesAPI } from '../services/api'

function Courses({ onNavigate, cart, setCart, isLoggedIn, preSelectedBranch, setSelectedCourseForSchedule }) {
  const { showNotification } = useNotification()
  const [sortBy, setSortBy] = useState('best-selling')
  const [priceFilter, setPriceFilter] = useState('all')
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [courseType, setCourseType] = useState('online')
  const [quantity, setQuantity] = useState(1)
  const [courses, setCourses] = useState([])
  const [branchContacts, setBranchContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [mainImage, setMainImage] = useState(null)

  // Format branch name - remove company prefixes
  const formatBranchName = (name) => {
    if (!name) return name;

    const prefixes = [
      'Master Driving School ',
      'Master Prime Driving School ',
      'Masters Prime Holdings Corp. ',
      'Master Prime Holdings Corp. '
    ];

    let formattedName = name;
    for (const prefix of prefixes) {
      if (formattedName.startsWith(prefix)) {
        formattedName = formattedName.substring(prefix.length);
        break;
      }
    }

    return formattedName;
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        const [coursesRes, branchesRes] = await Promise.all([
          coursesAPI.getAll(),
          branchesAPI.getAll()
        ]);

        if (coursesRes.success) {
          const activeCourses = coursesRes.courses.filter(c => c.status === 'active');
          setCourses(activeCourses);
        } else {
          showNotification('Failed to fetch courses', 'error');
        }

        if (branchesRes.success) {
          setBranchContacts(branchesRes.branches);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        showNotification('An error occurred while loading data', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [showNotification]);

  // Transform database courses to match UI structure
  const packages = courses.map(course => {
    // Build type options array
    const typeOptions = [];

    // Add main course type with its price
    if (course.course_type) {
      typeOptions.push({
        value: course.course_type.toLowerCase().replace(/\s+/g, '-'),
        label: course.course_type.toUpperCase(),
        price: parseFloat(course.price)
      });
    }

    // Add pricing variations as additional type options
    if (course.pricing_data && Array.isArray(course.pricing_data)) {
      course.pricing_data.forEach(variation => {
        typeOptions.push({
          value: variation.type.toLowerCase().replace(/\s+/g, '-'),
          label: variation.type.toUpperCase(),
          price: parseFloat(variation.price)
        });
      });
    }

    // If no type options, create a default one
    if (typeOptions.length === 0) {
      typeOptions.push({
        value: 'standard',
        label: 'STANDARD',
        price: parseFloat(course.price)
      });
    }

    // Parse images - handle both array and JSON string formats
    let courseImages = [];
    if (course.image_url) {
      try {
        courseImages = typeof course.image_url === 'string'
          ? JSON.parse(course.image_url)
          : course.image_url;

        // Ensure it's an array
        if (!Array.isArray(courseImages)) {
          courseImages = [courseImages];
        }

        // Add data URI prefix if it's a base64 string without it
        courseImages = courseImages.map(img => {
          if (img && !img.startsWith('data:') && !img.startsWith('http') && !img.startsWith('/')) {
            return `data:image/jpeg;base64,${img}`;
          }
          return img;
        });
      } catch (e) {
        courseImages = [];
      }
    }

    // Extract features from description or use defaults
    const features = course.description
      ? course.description.split(/[.\n]/).filter(f => f.trim() && f.length > 10).slice(0, 5)
      : [
        'Comprehensive driving training',
        'Experienced certified instructors',
        'LTO exam preparation',
        'Flexible schedule options',
        'Modern training facilities'
      ];

    // Determine display name and short name
    const displayName = course.name || 'Unnamed Course';
    const shortName = displayName.includes('(')
      ? displayName.split('(')[0].trim()
      : displayName.split('-')[0].trim();

    return {
      id: course.id,
      name: displayName,
      shortName: shortName,
      duration: `${course.duration || 8} Hours`,
      price: parseFloat(course.price) || 0,
      image: courseImages.length > 0 ? courseImages[0] : '/images/default-course.jpg',
      allImages: courseImages,
      features: features,
      hasTypeOption: true,
      typeOptions: typeOptions,
      category: course.category || 'Basic',
      brand: 'MASTER DRIVING SCHOOL PH',
      description: course.description || 'Professional driving course with comprehensive training',
      contact: 'Please contact our sales representative for enrollment assistance.',
      terms: 'Please be reminded that upon checking out you agree to our company terms and conditions. To check the available schedule for walk in you may call the numbers below:',
      enrolled: parseInt(course.enrolled) || 0,
      popular: false
    };
  });

  // Calculate Best Sellers dynamically
  const sortedByEnrollments = [...packages].sort((a, b) => b.enrolled - a.enrolled);
  const bestSellerIds = sortedByEnrollments
    .filter(pkg => pkg.enrolled > 0)
    .slice(0, 3)
    .map(pkg => pkg.id);

  packages.forEach(pkg => {
    pkg.popular = bestSellerIds.includes(pkg.id);
  });

  const addToCart = (pkg, qty = 1, type = 'online') => {
    // Only store lightweight fields — images are base64 blobs that blow localStorage quota
    const cartItem = {
      id: pkg.id,
      name: pkg.name,
      shortName: pkg.shortName,
      duration: pkg.duration,
      price: pkg.price,
      category: pkg.category,
      typeOptions: pkg.typeOptions,
      hasTypeOption: pkg.hasTypeOption,
      quantity: qty,
      type: type,
    }
    const existingItem = cart.find(item => item.id === pkg.id && item.type === type)
    if (existingItem) {
      setCart(cart.map(item =>
        item.id === pkg.id && item.type === type
          ? { ...item, quantity: item.quantity + qty }
          : item
      ))
    } else {
      setCart([...cart, cartItem])
    }
  }

  const handleAddToCartFromDetail = () => {
    if (!isLoggedIn) {
      showNotification("Please sign in to add courses to your cart. Guest enrollment provides direct checkout.", "error")
      return
    }

    if (selectedCourse) {
      addToCart(selectedCourse, quantity, courseType)
      showNotification(`${selectedCourse.shortName} added to cart!`, "success")
    }
  }

  const handleEnrollNow = () => {

    if (!preSelectedBranch) {
      showNotification("Please select a branch first from the Branches page", "error")
      onNavigate('branches')
      return
    }

    if (selectedCourse) {
      // Only store lightweight fields to avoid localStorage QuotaExceededError (images are base64 blobs)
      setSelectedCourseForSchedule({
        id: selectedCourse.id,
        name: selectedCourse.name,
        shortName: selectedCourse.shortName,
        duration: selectedCourse.duration,
        price: selectedCourse.price,
        category: selectedCourse.category,
        typeOptions: selectedCourse.typeOptions,
        hasTypeOption: selectedCourse.hasTypeOption,
        selectedType: courseType,
      })
      if (!isLoggedIn) {
        onNavigate('guest-enrollment')
      } else {
        onNavigate('schedule')
      }
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleViewCourse = (pkg) => {
    setSelectedCourse(pkg)
    setMainImage(pkg.image)
    // Set default course type based on available options
    if (pkg.typeOptions && pkg.typeOptions.length > 0) {
      setCourseType(pkg.typeOptions[0].value)
    } else {
      setCourseType('standard')
    }
    setQuantity(1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleBackToListing = () => {
    setSelectedCourse(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Filter and sort logic
  const getFilteredPackages = () => {
    let filtered = [...packages]

    // Apply price filter
    if (priceFilter !== 'all') {
      if (priceFilter === 'under-3000') {
        filtered = filtered.filter(pkg => pkg.price > 0 && pkg.price < 3000)
      } else if (priceFilter === '3000-4000') {
        filtered = filtered.filter(pkg => pkg.price >= 3000 && pkg.price < 4000)
      } else if (priceFilter === 'over-4000') {
        filtered = filtered.filter(pkg => pkg.price >= 4000)
      }
    }

    // Apply sorting
    if (sortBy === 'price-low-high') {
      filtered.sort((a, b) => a.price - b.price)
    } else if (sortBy === 'price-high-low') {
      filtered.sort((a, b) => b.price - a.price)
    } else if (sortBy === 'popular') {
      filtered.sort((a, b) => (b.popular ? 1 : 0) - (a.popular ? 1 : 0))
    }

    return filtered
  }

  const filteredPackages = getFilteredPackages()

  // If a course is selected, show detail view
  if (selectedCourse) {
    return (
      <div className="py-12 sm:py-16 lg:py-20 bg-gray-50 min-h-[calc(100vh-4rem)] w-full font-primary">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
          {/* Selected Branch Indicator */}
          {preSelectedBranch && (
            <div className="bg-gradient-to-r from-blue-50 to-blue-100/50 border-2 border-blue-300 rounded-2xl p-5 sm:p-6 mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm" data-aos="fade-down">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#2157da] rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                  <span className="text-2xl">📍</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-[#2157da] uppercase tracking-wide mb-1">Enrolling at this branch</p>
                  <p className="text-base sm:text-lg font-bold text-gray-900 leading-tight">{formatBranchName(preSelectedBranch.name)}</p>
                </div>
              </div>
              <button
                onClick={() => onNavigate('branches')}
                className="text-sm font-bold text-[#2157da] bg-white hover:bg-blue-50 px-5 py-2.5 rounded-xl border-2 border-[#2157da] transition-all hover:shadow-md active:scale-95 self-start sm:self-center"
              >
                Change Branch
              </button>
            </div>
          )}

          {/* Back to Listing */}
          <button
            onClick={handleBackToListing}
            className="flex items-center text-gray-700 hover:text-[#2157da] mb-8 font-medium"
            data-aos="fade-right"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            BACK TO LISTING
          </button>

          {/* Course Detail */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12" data-aos="fade-up">
            {/* Course Image */}
            <div className="relative">
              <div className="w-full aspect-square bg-gradient-to-br from-[#2157da] to-[#1a3a8a] rounded-lg overflow-hidden relative border border-gray-200 shadow-sm">
                {mainImage ? (
                  <img
                    src={mainImage}
                    alt={selectedCourse.name}
                    className="w-full h-full object-contain bg-white"
                    onError={(e) => {
                      e.target.style.display = 'none'
                      e.target.nextSibling.style.display = 'flex'
                    }}
                  />
                ) : null}
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#2157da] to-[#1a3a8a] text-white" style={{ display: mainImage ? 'none' : 'flex' }}>
                  <div className="text-center">
                    <svg className="w-24 h-24 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    <p className="text-xl font-bold">{selectedCourse.shortName}</p>
                  </div>
                </div>
              </div>

              {/* Thumbnail Images */}
              {selectedCourse.allImages && selectedCourse.allImages.length > 1 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {selectedCourse.allImages.map((img, i) => (
                    <div
                      key={i}
                      className={`w-20 h-20 bg-white rounded-md overflow-hidden cursor-pointer border-2 transition-all shadow-sm ${mainImage === img ? 'border-[#2157da] scale-105' : 'border-transparent hover:border-gray-300'}`}
                      onClick={() => setMainImage(img)}
                    >
                      <img src={img} alt={`${selectedCourse.name} thumbnail ${i + 1}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Course Details */}
            <div className="text-left">
              <p className="text-xs text-gray-500 font-medium mb-2 uppercase tracking-wider">
                {selectedCourse.brand}
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#2157da] mb-4">
                {selectedCourse.name}
              </h1>
              <p className="text-3xl font-bold text-gray-800 mb-6">
                {selectedCourse.priceNote || `₱${(selectedCourse.typeOptions?.find(opt => opt.value === courseType)?.price || selectedCourse.price).toLocaleString()}`}
              </p>

              {/* Type Selection */}
              {selectedCourse.hasTypeOption && selectedCourse.typeOptions && selectedCourse.typeOptions.length > 0 && (
                <div className="mb-6">
                  <label className="block text-xs font-bold text-gray-700 mb-3 uppercase tracking-wider text-left">
                    TYPE
                  </label>
                  <div className="flex gap-2">
                    {selectedCourse.typeOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setCourseType(option.value)}
                        className={`px-5 py-2 text-sm font-medium transition-all ${courseType === option.value
                          ? 'bg-[#2157da] text-white rounded-full'
                          : 'bg-transparent text-gray-700 border border-gray-300 rounded-full hover:border-[#2157da]'
                          }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity */}
              <div className="mb-6">
                <label className="block text-xs font-bold text-gray-700 mb-3 uppercase tracking-wider text-left">
                  QUANTITY
                </label>
                <div className="flex items-center gap-0 w-fit border border-gray-300 rounded-md overflow-hidden">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 transition-colors text-gray-600 font-medium"
                  >
                    −
                  </button>
                  <input
                    type="text"
                    value={quantity}
                    readOnly
                    className="w-12 h-10 text-center border-x border-gray-300 font-medium text-gray-800 bg-white"
                  />
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 transition-colors text-gray-600 font-medium"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 mb-8 relative">
                <button
                  onClick={handleAddToCartFromDetail}
                  className="w-full py-3 border border-gray-800 text-gray-800 rounded-md font-medium hover:bg-gray-800 hover:text-white transition-all text-sm active:scale-95"
                >
                  Add to cart
                </button>
                <button
                  onClick={handleEnrollNow}
                  className={`w-full py-3 rounded-md font-bold transition-all text-sm uppercase ${preSelectedBranch
                    ? 'bg-[#F3B74C] text-gray-800 hover:bg-[#e1a63b]'
                    : 'bg-[#2157da] text-white hover:bg-[#1a3a8a]'
                    }`}
                >
                  {preSelectedBranch ? 'ENROLL NOW' : 'SELECT BRANCH TO ENROLL'}
                </button>
              </div>

              {/* Course Information */}
              <div className="space-y-4 text-sm leading-relaxed">
                <p className="text-gray-700">{selectedCourse.description}</p>
                <p className="text-gray-600">{selectedCourse.contact}</p>
                <p className="text-gray-600">
                  Please be reminded that upon checking out <span className="text-red-600 font-semibold">you agree to our company terms and conditions.</span> To check the available schedule for walk in you may call the numbers below:
                </p>
              </div>

              {/* Contact Numbers */}
              <div className="mt-10 mb-8">
                <h3 className="text-sm font-bold text-gray-800 mb-6 uppercase tracking-wider text-center">CONTACT NUMBERS:</h3>
                <div className="flex justify-center">
                  <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-4 max-w-md w-full">
                    {branchContacts.map((branch, idx) => (
                      <div key={idx} className="contents text-[13px] sm:text-sm">
                        <span className="font-bold text-gray-900 text-right">{formatBranchName(branch.name)}:</span>
                        <span className="font-mono text-[#2157da] font-medium text-left tracking-wide">{branch.contact_number}</span>
                      </div>
                    ))}
                    {branchContacts.length === 0 && (
                      <div className="col-span-2 text-sm text-gray-500 italic text-center">No contact numbers available at this time.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Default listing view
  return (
    <div className="py-12 sm:py-16 lg:py-20 bg-gray-50 min-h-[calc(100vh-4rem)] w-full">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#2157da] mb-3"
            data-aos="fade-down"
          >
            ALL COURSES
          </h1>
          <p
            className="text-sm sm:text-base text-gray-600"
            data-aos="fade-down"
            data-aos-delay="100"
          >
            Choose your courses and add them to cart
          </p>

          {/* Selected Branch Indicator */}
          {preSelectedBranch && (
            <div className="max-w-md mx-auto bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mt-6 flex items-center justify-between gap-3 shadow-sm" data-aos="fade-up" data-aos-delay="200">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 bg-[#2157da] rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">📍</span>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-[#2157da] uppercase tracking-wide">Branch</p>
                  <p className="text-xs font-bold text-gray-900 truncate">{formatBranchName(preSelectedBranch.name)}</p>
                </div>
              </div>
              <button
                onClick={() => onNavigate('branches')}
                className="text-xs font-bold text-[#2157da] hover:underline flex-shrink-0"
              >
                Change
              </button>
            </div>
          )}
        </div>

        {/* Filter and Sort Section */}
        <div className="mb-8 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white p-4 rounded-lg shadow" data-aos="fade-up">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Price Filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Price:</label>
              <select
                value={priceFilter}
                onChange={(e) => setPriceFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2157da]"
              >
                <option value="all">All Prices</option>
                <option value="under-3000">Under ₱3,000</option>
                <option value="3000-4000">₱3,000 - ₱4,000</option>
                <option value="over-4000">Over ₱4,000</option>
              </select>
            </div>

            {/* Product Count */}
            <div className="text-sm text-gray-600">
              {filteredPackages.length} {filteredPackages.length === 1 ? 'product' : 'products'}
            </div>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2157da]"
            >
              <option value="best-selling">Best selling</option>
              <option value="popular">Popular</option>
              <option value="price-low-high">Price: Low to High</option>
              <option value="price-high-low">Price: High to Low</option>
            </select>
          </div>
        </div>

        {/* Course Products */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2157da]"></div>
          </div>
        ) : filteredPackages.length === 0 ? (
          <div className="text-center py-20">
            <h3 className="text-xl font-bold text-gray-700">No courses available at the moment.</h3>
            <p className="text-gray-500 mt-2">Please check back later.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {filteredPackages.map((pkg, index) => (
              <div
                key={pkg.id}
                className={`bg-white rounded-lg shadow-md hover:shadow-xl transition-all overflow-hidden flex flex-col h-full ${pkg.popular ? 'ring-2 ring-[#F3B74C]' : ''
                  }`}
                data-aos="zoom-in"
                data-aos-delay={index * 100}
              >
                {/* Course Image */}
                <div
                  className="w-full aspect-square bg-gray-200 relative cursor-pointer group overflow-hidden"
                  onClick={() => handleViewCourse(pkg)}
                >
                  {pkg.image ? (
                    <img
                      src={pkg.image}
                      alt={pkg.name}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => {
                        e.target.style.display = 'none'
                        e.target.nextSibling.style.display = 'flex'
                      }}
                    />
                  ) : null}
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#2157da] to-[#1a3a8a] text-white" style={{ display: pkg.image ? 'none' : 'flex' }}>
                    <svg className="w-16 h-16 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  {pkg.popular && (
                    <div className="absolute top-2 left-2 bg-[#F3B74C] text-[#2157da] px-3 py-1 rounded-full text-xs font-bold">
                      BEST SELLER
                    </div>
                  )}
                </div>

                <div className="p-5 flex flex-col flex-grow">
                  <h3
                    className="text-lg font-bold text-[#2157da] mb-2 line-clamp-2 min-h-[56px] flex items-center justify-center text-center cursor-pointer hover:underline"
                    onClick={() => handleViewCourse(pkg)}
                  >
                    {pkg.name}
                  </h3>

                  <div className="text-gray-600 mb-3 text-sm text-center">
                    <span className="font-medium">{pkg.duration}</span>
                  </div>

                  <div className="mb-4 text-center">
                    {pkg.priceNote ? (
                      <div className="text-xl font-bold text-gray-800">{pkg.priceNote}</div>
                    ) : (
                      <div className="text-2xl font-bold text-gray-800">
                        {pkg.typeOptions && pkg.typeOptions.length > 0
                          ? pkg.typeOptions.length === 1
                            ? `₱${pkg.typeOptions[0].price.toLocaleString()}`
                            : `₱${Math.min(...pkg.typeOptions.map(o => o.price)).toLocaleString()} - ₱${Math.max(...pkg.typeOptions.map(o => o.price)).toLocaleString()}`
                          : `₱${pkg.price.toLocaleString()}`
                        }
                      </div>
                    )}
                  </div>

                  <ul className="space-y-1.5 mb-6 text-sm flex-grow">
                    {pkg.features.slice(0, 3).map((feature, idx) => (
                      <li key={idx} className="flex items-start text-gray-600">
                        <span className="text-[#2157da] mr-2 mt-0.5 flex-shrink-0">✓</span>
                        <span className="text-xs">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleViewCourse(pkg)}
                    className={`w-full py-2.5 mt-auto rounded-lg font-semibold transition-all text-sm ${pkg.popular
                      ? 'bg-[#F3B74C] text-[#2157da] hover:bg-[#e1a63b]'
                      : 'bg-[#2157da] text-white hover:bg-[#1a3a8a]'
                      } flex items-center justify-center gap-2`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Courses

