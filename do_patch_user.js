const fs = require('fs');

const path = 'booking-system-frontend/src/admin/User.jsx';
let code = fs.readFileSync(path, 'utf8');

const oldHtml = \<div className="form-group" style={{ marginBottom: '15px' }}>
                                            <label style={{
                                                fontSize: '0.8rem',
                                                fontWeight: '600',
                                                color: 'var(--text-color)',
                                                marginBottom: '6px',
                                                display: 'block'
                                            }}>
                                                Complete Address <span style={{ color: '#ef4444' }}>*</span>
                                            </label>
                                            <textarea
                                                name="address"
                                                placeholder="e.g. 123 Street Name, Barangay, City, Province"
                                                value={userData.address}
                                                onChange={handleInputChange}
                                                rows="2"
                                                required
                                                style={{
                                                    width: '100%',
                                                    padding: '11px 14px',
                                                    borderRadius: '10px',
                                                    border: '1.5px solid var(--border-color)',
                                                    background: 'var(--card-bg)',
                                                    fontSize: '0.9rem',
                                                    color: 'var(--text-color)',
                                                    resize: 'vertical',
                                                    fontFamily: 'inherit',
                                                    minHeight: '60px'
                                                }}
                                            />
                                        </div>\;

const newHtml = \{/* Smart Address component mapping to User format (userData instead of formData, handleInputChange instead of handleChange) */}
                                        <div style={{ marginBottom: '15px' }}>
                                            <SmartAddress formData={userData} onChange={handleInputChange} errors={errors} />
                                        </div>\;

if (code.includes('textarea')) {
    code = code.replace(oldHtml, newHtml);
}

fs.writeFileSync(path, code, 'utf8');
console.log('patched user');
