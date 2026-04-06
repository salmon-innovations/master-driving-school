const fs = require('fs');

const guestPath = 'booking-system-frontend/src/pages/GuestEnrollment.jsx';
let code = fs.readFileSync(guestPath, 'utf8');

// 1. Import
if (!code.includes('import SmartAddress')) {
    code = code.replace(
        "import NationalitySelect from '../components/NationalitySelect'",
        "import NationalitySelect from '../components/NationalitySelect';\nimport SmartAddress from '../components/SmartAddress';"
    );
}

// 2. formData state
if (!code.includes('province:')) {
    code = code.replace(
        "address: '',",
        "address: '',\n    houseNumber: '',\n    streetName: '',\n    village: '',\n    province: '',\n    city: '',\n    barangay: '',"
    );
}

// 3. handleChange logic for address parts
if (!code.includes('addressPartsFields')) {
    const handleAdd = \
      // Re-evaluate combined address whenever address parts change
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
        return updated;
      }\
    code = code.replace(
        "      if (name === 'address') {\n        updated.zipCode = getZipFromAddress(formattedValue);\n      }",
        handleAdd
    );
}

// 4. validateStep2
code = code.replace(
    "if (!formData.address) newErrors.address = 'Address is required'",
    "if (!formData.houseNumber) newErrors.houseNumber = 'House Number is required';\n    if (!formData.streetName) newErrors.streetName = 'Street is required';\n    if (!formData.province) newErrors.province = 'Province is required';\n    if (!formData.city) newErrors.city = 'City is required';\n    if (!formData.barangay) newErrors.barangay = 'Barangay is required';"
);

// 5. Replace address block
code = code.replace(/<div className="md:col-span-3">[\s\S]*?\{errors\.address \S\S <p className="text-\[10px\] text-red-500 font-bold mt-1\.5 ml-1">\{errors\.address\}<\/p>\}[\s\S]*?<\/div>/, '<div className="md:col-span-4"><SmartAddress formData={formData} onChange={handleChange} errors={errors} /></div>');

code = code.replace('<div>\\n                          <label className="text-[0.65rem] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Zip Code</label>\\n                          <input', '<div className="md:col-span-2">\\n                          <label className="text-[0.65rem] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Zip Code</label>\\n                          <input');

fs.writeFileSync(guestPath, code, 'utf8');
console.log('Done guest');
