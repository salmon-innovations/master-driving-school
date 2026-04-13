const fs = require('fs');

const code = import React, { useState, useEffect } from 'react';
import { promoAPI, coursesAPI } from '../../services/api';
import { useNotification } from '../../context/NotificationContext';

const PromoPackageManagement = () => {
    const { showNotification } = useNotification();
    const [packages, setPackages] = useState([]);
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        status: 'active',
        start_date: '',
        end_date: '',
        applicable_branches: [],
        trigger_rule_type: 'ANY_PDC',
        trigger_course_ids: [],
        reward_mode: 'F2F',
        max_free_qty: 1
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const pkgData = await promoAPI.getAll();
                setPackages(pkgData);
                const cData = await coursesAPI.getAll();
                setCourses(cData.filter(c => c.status === 'active' && c.course_type === 'PDC'));
            } catch (err) {
                console.error(err);
                showNotification('Failed to load promo data', 'error');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                name: formData.name,
                description: formData.description,
                status: formData.status,
                start_date: formData.start_date,
                end_date: formData.end_date,
                applicable_branches: formData.applicable_branches,
                trigger_rule: {
                    type: formData.trigger_rule_type,
                    course_ids: formData.trigger_rule_type === 'SPECIFIC' ? formData.trigger_course_ids : []
                },
                reward_rule: { type: 'TDC', mode: 'F2F' },
                max_free_qty: formData.max_free_qty,
                is_stackable: false
            };
            const result = await promoAPI.create(payload);
            setPackages([result, ...packages]);
            setShowModal(false);
            showNotification('Promo package created successfully', 'success');
        } catch (err) {
            showNotification('Error creating package', 'error');
        }
    };

    return (
        <div className="promo-packages-container">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Promo Packages</h2>
                <button
                    onClick={() => setShowModal(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                    + Create Package
                </button>
            </div>

            {loading ? <p>Loading packages...</p> : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Package Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trigger</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reward</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usage Count</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {packages.length === 0 && (
                                <tr><td colSpan="5" className="px-6 py-4 text-center text-gray-500">No promo packages found</td></tr>
                            )}
                            {packages.map(pkg => (
                                <tr key={pkg.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">{pkg.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={\px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full \$\{pkg.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'\}\}>
                                            {pkg.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {pkg.trigger_rule.type === 'ANY_PDC' ? 'Any PDC' : 'Selected PDCs'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">Free TDC F2F</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{pkg.usage_count}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1000] p-4 font-inter">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-bold text-gray-900 mb-6">Create Promo Package</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Package Name</label>
                                <input required type="text" name="name" value={formData.name} onChange={handleChange} className="mt-1 w-full border border-gray-300 rounded-lg p-3 text-sm" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Start Date</label>
                                    <input required type="date" name="start_date" value={formData.start_date} onChange={handleChange} className="mt-1 w-full border border-gray-300 rounded-lg p-3 text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">End Date</label>
                                    <input required type="date" name="end_date" value={formData.end_date} onChange={handleChange} className="mt-1 w-full border border-gray-300 rounded-lg p-3 text-sm" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Trigger Rule</label>
                                <select name="trigger_rule_type" value={formData.trigger_rule_type} onChange={handleChange} className="mt-1 w-full border border-gray-300 rounded-lg p-3 text-sm">
                                    <option value="ANY_PDC">Enroll in Any PDC</option>
                                    <option value="SPECIFIC">Selected PDC Courses Only</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700" style={{color: 'green'}}>Reward</label>
                                <input type="text" disabled value="Free TDC F2F (Face-to-Face)" className="mt-1 w-full bg-green-50 text-green-800 border-none font-semibold rounded-lg p-3 text-sm cursor-not-allowed" />
                            </div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 text-sm font-semibold text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-50">Cancel</button>
                                <button type="submit" className="px-5 py-2.5 text-sm font-semibold text-white bg-[#10b981] rounded-xl hover:bg-[#059669]">Create Package</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PromoPackageManagement;
;
fs.writeFileSync('src/admin/components/PromoPackageManagement.jsx', code);
