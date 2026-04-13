const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, 'src/admin/CourseManagement.jsx');
let content = fs.readFileSync(target, 'utf8');

const tabHtml = '                {canAccessCourseTab(\'packages\') && (\\n                    <button\\n                        className={cfg-tab-btn\}\\n                        onClick={() => setActiveTab(\\'packages\\')}\\n                        style={{ marginBottom: \\'-2px\\' }}\\n                    >\\n                        <span className="cfg-tab-icon">\\n                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>\\n                        </span>\\n                        <span className="tab-label">Packages</span>\\n                    </button>\\n                )}\\n            </div>';

content = content.replace(/<span className="tab-label">Config<\/span>\s*<\/button>\s*\)\}\s*<\/div>/g, '<span className="tab-label">Config</span>\\n                    </button>\\n                )}\\n' + tabHtml);

const contentHtml = '\\n            {activeTab === \\'packages\\' && (\\n                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm max-w-6xl mx-auto p-6">\\n                    <PromoPackageManagement />\\n                </div>\\n            )}\\n';

content = content.replace(/\{renderModal\(\)\}/, contentHtml + '\\n            {renderModal()}');

fs.writeFileSync(target, content);
console.log('Injected successfully');
