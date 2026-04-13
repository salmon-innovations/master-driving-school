const fs = require('fs');
const filepath = 'c:/Users/gabas/OneDrive/Desktop/Booking System/booking-system-frontend/src/admin/SalePayment.jsx';
let content = fs.readFileSync(filepath, 'utf8');

const anchor =                                   </BarChart>
                              </ResponsiveContainer>
                          </div>
                      </div>
                  </div>

                  <div className="payment-method-chart">;

const replacement =                                   </BarChart>
                              </ResponsiveContainer>
                          </div>
                      </div>

                      {adminProfile?.role === 'super_admin' && revenueData?.addon_breakdown?.length > 0 && (
                          <div className="chart-card" style={{ marginTop: '20px' }}>
                              <div className="card-header">
                                  <h3>Top Selling Add-ons</h3>
                                  <span>All-time items count and revenue</span>
                              </div>
                              <div className="chart-body">
                                  <ResponsiveContainer width="100%" height={280}>
                                      <BarChart data={revenueData.addon_breakdown} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                                          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                          <Tooltip
                                              cursor={{ fill: 'rgba(148,163,184,0.08)' }}
                                              formatter={(value, name) => [name === 'revenue' ? \?\\ : value, name === 'revenue' ? 'Total Revenue' : 'Units Sold']}
                                              contentStyle={{ borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-color)', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2)' }}
                                          />
                                          <Bar dataKey="revenue" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={50} />
                                      </BarChart>
                                  </ResponsiveContainer>
                              </div>
                          </div>
                      )}

                  </div>

                  <div className="payment-method-chart">;

if (content.includes(anchor)) {
    content = content.replace(anchor, replacement);
    fs.writeFileSync(filepath, content, 'utf8');
    console.log('Patched');
} else {
    console.log('Anchor not found');
}
