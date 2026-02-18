import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { useAnalyticsReports } from './hooks/useAnalyticsReports';
import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    FunnelChart,
    Funnel,
    LabelList,
    PieChart,
    Pie,
    Cell
} from 'recharts';
import './css/analytics.css';



const AnalyticsReports = () => {
    const { theme } = useTheme();
    const { loading, analyticsData, bestSellingCourses } = useAnalyticsReports();

    return (
        <div className="analytics-view animate-fadeIn">
            <section className="stats-grid">
                <div className="stat-card">
                    <div className="stat-info">
                        <h3>Growth Rate</h3>
                        <div className="stat-value" style={{ color: parseFloat(analyticsData?.stats?.growthRate || 0) >= 0 ? '#10b981' : '#ef4444' }}>
                            {loading ? '...' : ((parseFloat(analyticsData?.stats?.growthRate || 0) >= 0 ? '+' : '') + (analyticsData?.stats?.growthRate || 0))}%
                        </div>
                        <div className="stat-label">vs last month</div>
                    </div>
                    <div className="stat-icon growth">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-info">
                        <h3>Retention</h3>
                        <div className="stat-value">{loading ? '...' : analyticsData?.stats?.retention}%</div>
                        <div className="stat-label">Student satisfaction</div>
                    </div>
                    <div className="stat-icon retention">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-info">
                        <h3>Traffic</h3>
                        <div className="stat-value">{loading ? '...' : analyticsData?.stats?.traffic}</div>
                        <div className="stat-label">Page views</div>
                    </div>
                    <div className="stat-icon traffic">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    </div>
                </div>

            </section>

            <div className="analytics-grid-main">
                <div className="chart-card funnel-card">
                    <div className="chart-header">
                        <div className="header-text">
                            <h3>Conversion Funnel</h3>
                            <p>Student journey tracking</p>
                        </div>
                        <div className="header-badge">Live</div>
                    </div>
                    <div className="chart-wrapper" style={{ height: '350px' }}>
                        {loading ? <div className="chart-loading">...</div> : (
                            <div className="horizontal-funnel-wrapper">
                                <ResponsiveContainer width="100%" height="100%">
                                    <FunnelChart>
                                        <Tooltip
                                            contentStyle={{
                                                borderRadius: '16px',
                                                border: 'none',
                                                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
                                                background: theme === 'dark' ? '#1e293b' : '#ffffff',
                                                padding: '12px'
                                            }}
                                        />
                                        <Funnel
                                            dataKey="value"
                                            data={analyticsData?.funnel || []}
                                            isAnimationActive
                                            labelLine={false}
                                        >
                                            <LabelList
                                                position="center"
                                                fill="#ffffff"
                                                stroke="none"
                                                dataKey="name"
                                                className="funnel-label-text"
                                                fontSize={13}
                                                fontWeight={700}
                                            />
                                            <LabelList
                                                position="right"
                                                fill={theme === 'dark' ? '#94a3b8' : '#64748b'}
                                                stroke="none"
                                                dataKey="value"
                                                className="funnel-value-text"
                                                fontSize={12}
                                                formatter={(value) => `${value}`}
                                            />
                                        </Funnel>
                                    </FunnelChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>
                </div>

                <div className="chart-card distribution-card">
                    <div className="chart-header">
                        <div className="header-text">
                            <h3>Course Distribution</h3>
                            <p>Enrollees by course type</p>
                        </div>
                        <div className="header-badge success">Live</div>
                    </div>
                    <div className="chart-wrapper" style={{ height: '300px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={(analyticsData?.courseDistribution || []).map(d => ({ name: d.category, value: parseInt(d.count) || 0 }))}
                                    innerRadius={70}
                                    outerRadius={90}
                                    paddingAngle={8}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {(analyticsData?.courseDistribution || []).map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][index % 5]}
                                            stroke="none"
                                        />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        borderRadius: '12px',
                                        border: 'none',
                                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                                        background: theme === 'dark' ? '#1e293b' : '#ffffff'
                                    }}
                                />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="chart-card statistics-card insights-card">
                    <div className="chart-header">
                        <div className="header-text">
                            <h3>Performance Metrics</h3>
                            <p>Key business indicators</p>
                        </div>
                        <div className="header-badge">Monthly</div>
                    </div>
                    <div className="insights-content">
                        <div className="insight-item">
                            <div className="insight-label">
                                <span>Growth Rate</span>
                                <span className="trend positive">+{analyticsData?.stats?.growthRate || 0}%</span>
                            </div>
                            <div className="insight-progress-bg">
                                <div className="insight-progress-fill" style={{ width: `${analyticsData?.stats?.growthRate || 0}%`, background: 'var(--primary-color)' }}></div>
                            </div>
                        </div>

                        <div className="insight-item">
                            <div className="insight-label">
                                <span>Retention</span>
                                <span className="trend positive">{analyticsData?.stats?.retention || 0}%</span>
                            </div>
                            <div className="insight-progress-bg">
                                <div className="insight-progress-fill" style={{ width: `${analyticsData?.stats?.retention || 0}%`, background: '#10b981' }}></div>
                            </div>
                        </div>

                        <div className="insight-stats-row">
                            <div className="mini-stat">
                                <span className="mini-label">Monthly Traffic</span>
                                <span className="mini-value">{analyticsData?.stats?.traffic || 0}</span>
                            </div>
                            <div className="mini-stat">
                                <span className="mini-label">Active Users</span>
                                <span className="mini-value">2.4k</span>
                            </div>
                        </div>

                        <div className="insights-footer-btn">
                            <button className="view-details-btn">View Detailed Report</button>
                        </div>
                    </div>
                </div>
            </div>

            <section className="analytics-secondary-grid">
                <div className="chart-card trend-card">
                    <div className="chart-header">
                        <h3>Revenue Trend (6 Months)</h3>
                    </div>
                    <div className="chart-wrapper" style={{ height: '300px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={analyticsData?.monthlyTrend || []}>
                                <defs>
                                    <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9} />
                                        <stop offset="50%" stopColor="#60a5fa" stopOpacity={0.4} />
                                        <stop offset="100%" stopColor="#93c5fd" stopOpacity={0.05} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} opacity={0.5} />
                                <XAxis
                                    dataKey="month"
                                    axisLine={false}
                                    tickLine={false}
                                    style={{ fontSize: '0.85rem', fontWeight: 600, fill: theme === 'dark' ? '#94a3b8' : '#64748b' }}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    style={{ fontSize: '0.85rem', fontWeight: 600, fill: theme === 'dark' ? '#94a3b8' : '#64748b' }}
                                />
                                <Tooltip
                                    contentStyle={{
                                        borderRadius: '16px',
                                        border: 'none',
                                        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
                                        background: theme === 'dark' ? '#1e293b' : '#ffffff',
                                        padding: '12px 16px',
                                        fontWeight: 600
                                    }}
                                    cursor={{ stroke: '#3b82f6', strokeWidth: 2, strokeDasharray: '5 5' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="revenue"
                                    stroke="#3b82f6"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorTrend)"
                                    dot={{ fill: '#3b82f6', strokeWidth: 2, r: 5, stroke: '#ffffff' }}
                                    activeDot={{ r: 7, fill: '#3b82f6', stroke: '#ffffff', strokeWidth: 3 }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="chart-card branch-performance-card">
                    <div className="chart-header">
                        <h3>Branch Performance</h3>
                    </div>
                    <div className="performance-list">
                        {(analyticsData?.branchPerformance || []).map((branch, index) => (
                            <div key={index} className="performance-item">
                                <div className="branch-info">
                                    <span className="branch-name">{branch.branch_name}</span>
                                    <span className="branch-revenue">₱{parseFloat(branch.revenue).toLocaleString()}</span>
                                </div>
                                <div className="progress-bar-bg">
                                    <div
                                        className="progress-bar-fill"
                                        style={{
                                            width: `${(parseFloat(branch.revenue) / (Math.max(...(analyticsData?.branchPerformance || []).map(b => parseFloat(b.revenue) || 0)) || 1)) * 100}%`,
                                            background: `linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)`
                                        }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                        {(analyticsData?.branchPerformance || []).length === 0 && <p className="no-data">No branch data available</p>}
                    </div>
                </div>

                <div className="chart-card enrollment-source-card">
                    <div className="chart-header">
                        <div className="header-text">
                            <h2>Student Enrollment</h2>
                            <p>Walk in Trend</p>
                        </div>
                        <div className="header-badge primary">New</div>
                    </div>
                    <div className="chart-wrapper enrollment-chart" style={{ height: '320px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={analyticsData?.monthlyTrend || []}>
                                <defs>
                                    <linearGradient id="colorStudent" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={1} />
                                        <stop offset="100%" stopColor="#fbbf24" stopOpacity={0.8} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} opacity={0.5} />
                                <XAxis
                                    dataKey="month"
                                    axisLine={false}
                                    tickLine={false}
                                    style={{ fontSize: '0.85rem', fontWeight: 600, fill: theme === 'dark' ? '#94a3b8' : '#64748b' }}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    style={{ fontSize: '0.85rem', fontWeight: 600, fill: theme === 'dark' ? '#94a3b8' : '#64748b' }}
                                />
                                <Tooltip
                                    cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }}
                                    contentStyle={{
                                        borderRadius: '16px',
                                        border: 'none',
                                        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
                                        background: theme === 'dark' ? '#1e293b' : '#ffffff',
                                        padding: '12px 16px',
                                        fontWeight: 600
                                    }}
                                />
                                <Bar
                                    dataKey="added"
                                    name="Student Enrollments"
                                    fill="url(#colorStudent)"
                                    radius={[8, 8, 8, 8]}
                                    barSize={28}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </section>


        </div>
    );
};

export default AnalyticsReports;
