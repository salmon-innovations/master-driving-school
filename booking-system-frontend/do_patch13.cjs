const fs = require('fs');
const filepath = 'c:/Users/gabas/OneDrive/Desktop/Booking System/booking-system-frontend/src/admin/SalePayment.jsx';
let content = fs.readFileSync(filepath, 'utf8');

const anchor = '                                  </BarChart>\n                              </ResponsiveContainer>\n                          </div>\n                      </div>\n                  </div>\n\n                  <div className="payment-method-chart">';

const replacement = '                                  </BarChart>\n                              </ResponsiveContainer>\n                          </div>\n                      </div>\n\n                      {adminProfile?.role === \'super_admin\' && revenueData?.addon_breakdown?.length > 0 && (\n                          <div className="chart-card" style={{ marginTop: \'20px\' }}>\n                              <div className="card-header">\n                                  <h3>Top Selling Add-ons</h3>\n                                  <span>All-time items count and revenue</span>\n                              </div>\n                              <div className="chart-body">\n                                  <ResponsiveContainer width="100%" height={280}>\n                                      <BarChart data={revenueData.addon_breakdown} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>\n                                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />\n                                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: \'#94a3b8\', fontSize: 12 }} dy={10} />\n                                          <YAxis axisLine={false} tickLine={false} tick={{ fill: \'#94a3b8\', fontSize: 12 }} />\n                                          <Tooltip formatter={(v,n) => [v,n]} />\n                                          <Bar dataKey="revenue" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={50} />\n                                      </BarChart>\n                                  </ResponsiveContainer>\n                              </div>\n                          </div>\n                      )}\n                  </div>\n\n                  <div className="payment-method-chart">';

if (content.includes(anchor)) {
    content = content.replace(anchor, replacement);
    fs.writeFileSync(filepath, content, 'utf8');
    console.log('Patched');
} else {
    console.log('Anchor not found. Try regex.');
    const regex = /<\/BarChart>\s*<\/ResponsiveContainer>\s*<\/div>\s*<\/div>\s*<\/div>\s*<div\s+className="payment-method-chart">/;
    if (regex.test(content)) {
        content = content.replace(regex, replacement.trim());
        fs.writeFileSync(filepath, content, 'utf8');
        console.log('Patched with regex');
    }
}
