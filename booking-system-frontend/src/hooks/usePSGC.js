import { useState, useEffect } from 'react';

const API_BASE = 'https://psgc.gitlab.io/api';

export const usePSGC = () => {
    const [provinces, setProvinces] = useState([]);
    const [cities, setCities] = useState([]);
    const [barangays, setBarangays] = useState([]);

    const fetchProvinces = async () => {
        try {
            const res = await fetch(`${API_BASE}/provinces`);
            const data = await res.json();
            // Add Metro Manila manually since it's a region treated as a province in forms
            data.push({ code: '130000000', name: 'Metro Manila' });
            // Sort alphabetically
            data.sort((a, b) => a.name.localeCompare(b.name));
            setProvinces(data);
        } catch (error) {
            console.error('Error fetching provinces:', error);
        }
    };

    const fetchCities = async (provinceCode) => {
        if (!provinceCode) {
            setCities([]);
            setBarangays([]);
            return;
        }
        try {
            let url = `${API_BASE}/provinces/${provinceCode}/cities-municipalities`;
            if (provinceCode === '130000000') {
                url = `${API_BASE}/regions/${provinceCode}/cities-municipalities`;
            }
            const res = await fetch(url);
            const data = await res.json();
            data.sort((a, b) => a.name.localeCompare(b.name));
            setCities(data);
        } catch (error) {
           console.error('Error fetching cities:', error);
        }
    };

    const fetchBarangays = async (cityCode) => {
        if (!cityCode) {
            setBarangays([]);
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/cities-municipalities/${cityCode}/barangays`);
            const data = await res.json();
            // Some API cities missing barangays edge case
            if (data && data.length > 0) {
                data.sort((a, b) => a.name.localeCompare(b.name));
                setBarangays(data);
            } else {
                setBarangays([]);
            }
        } catch (error) {
            console.error('Error fetching barangays:', error);
        }
    };

    useEffect(() => {
        fetchProvinces();
    }, []);

    return { provinces, cities, barangays, fetchCities, fetchBarangays };
};
 
