const fs = require('fs');
const file = 'C:/Users/gabas/OneDrive/Desktop/Booking System/booking-system-frontend/src/admin/config/EmailContentSection.jsx';
let content = fs.readFileSync(file, 'utf8');

const iconsStr = 
const Icons = {
  walkIn: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>,
  guest: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  noShow: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>,
  news: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>,
  receipt: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17V7"/></svg>,
  newAccount: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>,
  verification: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
};
;

if (!content.includes('const Icons = {')) {
    content = content.replace(/(export default function EmailContentSection\(\) \{)/, \ + '\n' + iconsStr);
}

const newTypesStr =     const emailTypes = [
        { id: 'walkIn', title: 'Walk-In Enrollment', desc: 'Sent to walk-in students with credentials.', color: 'emerald', icon: Icons.walkIn },
        { id: 'guest', title: 'Guest Enrollment', desc: 'Sent to guests enrolling themselves.', color: 'blue', icon: Icons.guest },
        { id: 'noShow', title: 'No-Show / Missed', desc: 'Sent when a student misses a session.', color: 'rose', icon: Icons.noShow },
        { id: 'news', title: 'News & Promos', desc: 'Promotional broadcast emails.', color: 'purple', icon: Icons.news },
        { id: 'receipt', title: 'Payment Receipt', desc: 'Sent after successful transactions.', color: 'amber', icon: Icons.receipt },
        { id: 'newAccount', title: 'New Admin Account', desc: 'Sent to new staff members.', color: 'indigo', icon: Icons.newAccount },
        { id: 'verification', title: 'Verification & OTP', desc: 'Sent when users register or reset passwords.', color: 'slate', icon: Icons.verification }
    ];;

content = content.replace(/const emailTypes = \[[\s\S]*?\];/, newTypesStr);

const newGridStr =               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {emailTypes.map(type => {
                    const Icon = type.icon || (()=><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>);
                    const colorClasses = {
                        emerald: 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600',
                        blue: 'bg-blue-50 text-blue-600 group-hover:bg-blue-600',
                        rose: 'bg-rose-50 text-rose-600 group-hover:bg-rose-600',
                        purple: 'bg-purple-50 text-purple-600 group-hover:bg-purple-600',
                        amber: 'bg-amber-50 text-amber-600 group-hover:bg-amber-600',
                        indigo: 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600',
                        slate: 'bg-slate-50 text-slate-600 group-hover:bg-slate-600',
                    }[type.color] || 'bg-blue-50 text-blue-600 group-hover:bg-blue-600';

                    const borderHoverClass = {
                        emerald: 'hover:border-emerald-300 hover:shadow-emerald-100',
                        blue: 'hover:border-blue-300 hover:shadow-blue-100',
                        rose: 'hover:border-rose-300 hover:shadow-rose-100',
                        purple: 'hover:border-purple-300 hover:shadow-purple-100',
                        amber: 'hover:border-amber-300 hover:shadow-amber-100',
                        indigo: 'hover:border-indigo-300 hover:shadow-indigo-100',
                        slate: 'hover:border-slate-300 hover:shadow-slate-100',
                    }[type.color] || 'hover:border-blue-300 hover:shadow-blue-100';

                    const textHoverClass = {
                        emerald: 'group-hover:text-emerald-700',
                        blue: 'group-hover:text-blue-700',
                        rose: 'group-hover:text-rose-700',
                        purple: 'group-hover:text-purple-700',
                        amber: 'group-hover:text-amber-700',
                        indigo: 'group-hover:text-indigo-700',
                        slate: 'group-hover:text-slate-700',
                    }[type.color] || 'group-hover:text-blue-700';

                    return (
                        <div key={type.id} onClick={() => setSelectedEmail(type.id)} className={\g-white border border-gray-200 rounded-2xl p-6 flex flex-col cursor-pointer hover:shadow-xl transition-all duration-300 group relative hover:-translate-y-1 block \\}>
                            <div className={\w-14 h-14 rounded-xl flex items-center justify-center mb-5 transition-all duration-300 group-hover:text-white shadow-sm \\}>
                                <Icon />
                            </div>
                            <h3 className={\ont-bold text-gray-800 text-lg mb-2 transition-colors \\}>{type.title}</h3>
                            <p className="text-sm text-gray-500 leading-relaxed mb-4 flex-1">{type.desc}</p>
                            
                            <div className="flex items-center justify-between font-semibold text-sm opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 duration-300 pt-3 border-t border-gray-100/0 group-hover:border-gray-100">
                                <span className={textHoverClass}>Configure Template</span>
                                <span className={textHoverClass}>&rarr;</span>
                            </div>
                        </div>
                    );
                })}
              </div>;

content = content.replace(/<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">[\s\S]*?<\/div>\s+\{\/\* Email Edit Modal \*\/\}/, newGridStr + '\n\n              {/* Email Edit Modal */}');

fs.writeFileSync(file, content);
console.log('Successfully patched EmailContentSection.jsx!');
