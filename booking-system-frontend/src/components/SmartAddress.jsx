import React, { useState, useEffect } from 'react';
import { usePSGC } from '../hooks/usePSGC';

const SmartAddress = ({
  formData,
  onChange,
  errors = {}
}) => {
  const { provinces, cities, barangays, fetchCities, fetchBarangays } = usePSGC();

  useEffect(() => {
     if (formData.province) {
        const foundProv = provinces.find(p => p.name === formData.province);
        if (foundProv) {
            fetchCities(foundProv.code);
        }
     }
  }, [provinces, formData.province]);

  useEffect(() => {
     if (formData.city && cities.length > 0) {
        const foundCity = cities.find(c => c.name === formData.city);
        if (foundCity) {
            fetchBarangays(foundCity.code);
        }
     }
  }, [cities, formData.city]);

  const handleSelectChange = (e) => {
    const { name, value } = e.target;
    
    // Provide pseudo-event to parent for the name
    onChange({ target: { name, value } });

    // Handle cascading fetched
    if (name === 'province') {
        const p = provinces.find(x => x.name === value);
        if (p) fetchCities(p.code);
        else fetchCities('');
        // Clear children
        onChange({ target: { name: 'city', value: '' } });
        onChange({ target: { name: 'barangay', value: '' } });
    } else if (name === 'city') {
        const c = cities.find(x => x.name === value);
        if (c) fetchBarangays(c.code);
        else fetchBarangays('');
        onChange({ target: { name: 'barangay', value: '' } });
    }
  };

  const handleInputChange = (e) => {
    onChange(e);
  };

  return (
    <div className="space-y-4">
        {/* Row 1: House No, Street, Village */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">House/Blk/Lt No.</label>
              <input type="text" name="houseNumber" value={formData.houseNumber || ''} onChange={handleInputChange} className={"w-full px-4 py-3 bg-gray-50 border " + (errors.houseNumber ? "border-red-500" : "border-gray-200") + " rounded-lg focus:ring-2 focus:ring-[#2157da] outline-none transition-all"} placeholder="e.g. Blk 1 Lot 2" />
              {errors.houseNumber && <p className="text-xs text-red-500 mt-1">{errors.houseNumber}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Street Name <span className="text-red-500">*</span></label>
              <input type="text" name="streetName" value={formData.streetName || ''} onChange={handleInputChange} className={"w-full px-4 py-3 bg-gray-50 border " + (errors.streetName ? "border-red-500" : "border-gray-200") + " rounded-lg focus:ring-2 focus:ring-[#2157da] outline-none transition-all"} placeholder="e.g. Main St" />
              {errors.streetName && <p className="text-xs text-red-500 mt-1">{errors.streetName}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Village/Subdivision</label>
              <input type="text" name="village" value={formData.village || ''} onChange={handleInputChange} className={"w-full px-4 py-3 bg-gray-50 border " + (errors.village ? "border-red-500" : "border-gray-200") + " rounded-lg focus:ring-2 focus:ring-[#2157da] outline-none transition-all"} placeholder="(Optional)" />
            </div>
        </div>

        {/* Row 2: Province, City, Barangay */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Province <span className="text-red-500">*</span></label>
              <select name="province" value={formData.province || ''} onChange={handleSelectChange} className={"w-full px-4 py-3 bg-gray-50 border " + (errors.province ? "border-red-500" : "border-gray-200") + " rounded-lg focus:ring-2 focus:ring-[#2157da] outline-none transition-all"}>
                  <option value="">Select Province</option>
                  {provinces.map(p => (
                      <option key={p.code} value={p.name}>{p.name}</option>
                  ))}
              </select>
              {errors.province && <p className="text-xs text-red-500 mt-1">{errors.province}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">City/Municipality <span className="text-red-500">*</span></label>
              <select name="city" value={formData.city || ''} onChange={handleSelectChange} disabled={!cities.length && !formData.province} className={"w-full px-4 py-3 bg-gray-50 border " + (errors.city ? "border-red-500" : "border-gray-200") + " rounded-lg focus:ring-2 focus:ring-[#2157da] outline-none transition-all disabled:opacity-50"}>
                  <option value="">Select City</option>
                  {cities.map(c => (
                      <option key={c.code} value={c.name}>{c.name}</option>
                  ))}
              </select>
              {errors.city && <p className="text-xs text-red-500 mt-1">{errors.city}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Barangay <span className="text-red-500">*</span></label>
              <select name="barangay" value={formData.barangay || ''} onChange={handleSelectChange} disabled={!barangays.length && !formData.city} className={"w-full px-4 py-3 bg-gray-50 border " + (errors.barangay ? "border-red-500" : "border-gray-200") + " rounded-lg focus:ring-2 focus:ring-[#2157da] outline-none transition-all disabled:opacity-50"}>
                  <option value="">Select Barangay</option>
                  {barangays.map(b => (
                      <option key={b.code} value={b.name}>{b.name}</option>
                  ))}
              </select>
              {errors.barangay && <p className="text-xs text-red-500 mt-1">{errors.barangay}</p>}
            </div>
        </div>
    </div>
  );
};
export default SmartAddress;
