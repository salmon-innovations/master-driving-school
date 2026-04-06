const fs = require('fs');

const path = 'booking-system-frontend/src/pages/GuestEnrollment.jsx';
let code = fs.readFileSync(path, 'utf8');

// Import
if (!code.includes('import SmartAddress')) {
    code = code.replace(
        "import NationalitySelect from '../components/NationalitySelect'",
        "import NationalitySelect from '../components/NationalitySelect'\nimport SmartAddress from '../components/SmartAddress'"
    );
}

// formData initial state
code = code.replace(
    "address: '',",
    "address: '',\n    houseNumber: '',\n    streetName: '',\n    village: '',\n    barangay: '',\n    city: '',\n    province: '',"
);

// handleChange modifications
code = code.replace(
    "      // Auto-fill zip code based on Philippine city/municipality in address\n      if (name === 'address') {\n        updated.zipCode = getZipFromAddress(formattedValue);\n      }",
    \      // Re-evaluate combined address whenever address parts change
      const addressPartsFields = ['houseNumber', 'streetName', 'village', 'barangay', 'city', 'province'];
      if (addressPartsFields.includes(name)) {
        const parts = [
          updated.houseNumber,
          updated.streetName,
          updated.village,
          updated.barangay,
          updated.city,
          updated.province
        ].filter(Boolean);
        updated.address = parts.join(', ');

        const locationStr = [updated.barangay, updated.city, updated.province].filter(Boolean).join(', ');
        updated.zipCode = getZipFromAddress(locationStr) || updated.zipCode; // Auto-fill zip
      }\
);

// validateStep2 modifications
code = code.replace(
    "if (!formData.address) newErrors.address = 'Address is required'",
    "if (!formData.houseNumber) newErrors.houseNumber = 'House Number is required'\n    if (!formData.streetName) newErrors.streetName = 'Street is required'\n    if (!formData.province) newErrors.province = 'Province is required'\n    if (!formData.city) newErrors.city = 'City is required'\n    if (!formData.barangay) newErrors.barangay = 'Barangay is required'"
);

// UI React modifications
const addressHtml = \                        <div className="md:col-span-3">
                          <label className="text-[0.65rem] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Home Address</label>
                          <input
                            type="text"
                            name="address"
                            value={formData.address}
                            onChange={handleChange}
                            className={\\\w-full px-4 py-3.5 bg-white border-2 border-transparent shadow-sm rounded-xl focus:border-[#2157da] focus:ring-4 focus:ring-blue-50 outline-none transition-all font-semibold \\\\\\}
                            placeholder="House No., Street, Barangay, City"
                          />
                          {errors.address && <p className="text-[10px] text-red-500 font-bold mt-1.5 ml-1">{errors.address}</p>}
                        </div>\;
const smartAddressHtml = \                        <div className="md:col-span-4">
                          <SmartAddress formData={formData} onChange={handleChange} errors={errors} />
                        </div>\;
code = code.replace(addressHtml, smartAddressHtml);

// Zip code row span fix
code = code.replace(
    \                        <div>
                          <label className="text-[0.65rem] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Zip Code</label>\,
    \                        <div className="md:col-span-4">
                          <label className="text-[0.65rem] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Zip Code</label>\
);

fs.writeFileSync(path, code, 'utf8');
console.log('GuestEnrollment patched');
