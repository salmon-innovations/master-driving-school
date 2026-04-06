import React, { useState, useRef, useEffect } from 'react';
import { NATIONALITY_SUGGESTIONS } from '../constants/nationalities';

const NationalitySelect = ({ value, onChange, error, className, style }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef(null);

    useEffect(() => {
        setSearchTerm(value || '');
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredOptions = NATIONALITY_SUGGESTIONS.filter(nat => 
        nat.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSelect = (nat) => {
        setSearchTerm(nat);
        setIsOpen(false);
        onChange({ target: { name: 'nationality', value: nat } });
    };

    const handleInputChange = (e) => {
        setSearchTerm(e.target.value);
        setIsOpen(true);
        onChange({ target: { name: 'nationality', value: e.target.value } });
    };

    return (
        <div className="relative" ref={wrapperRef}>
            <input
                type="text"
                name="nationality"
                value={searchTerm}
                onChange={handleInputChange}
                onFocus={() => setIsOpen(true)}
                placeholder="e.g. Filipino"
                autoComplete="off"
                className={className}
                style={style}
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7"/>
                </svg>
            </div>
            
            {isOpen && filteredOptions.length > 0 && (
                <div className="absolute z-[100] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] max-h-56 overflow-y-auto custom-scrollbar">
                    {filteredOptions.map((nat) => (
                        <div
                            key={nat}
                            onClick={() => handleSelect(nat)}
                            className="px-4 py-3 text-[13px] cursor-pointer hover:bg-blue-50/80 hover:text-[#2157da] font-semibold text-gray-700 transition-colors border-b border-gray-50/50 last:border-0"
                        >
                            {nat}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default NationalitySelect;