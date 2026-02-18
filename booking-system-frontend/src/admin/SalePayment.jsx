import React, { useState, useEffect } from 'react';
import './css/sale.css';
import { adminAPI } from '../services/api';
const logo = '/images/logo.png';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    PieChart,
    Pie
} from 'recharts';

const SalePayment = () => {
    const [period, setPeriod] = useState('This Month');
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');

    const [transactions, setTransactions] = useState([]);
    const [allHistory, setAllHistory] = useState([]);
    const [unpaidBookings, setUnpaidBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [financialStats, setFinancialStats] = useState({
        revenue: 0,
        completed: 0,
        collectable: 0,
        refunds: 0
    });

    // Action Modal States
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [updateLoading, setUpdateLoading] = useState(false);

    const fetchTransactions = async () => {
        try {
            setLoading(true);
            const response = await adminAPI.getAllTransactions(100);
            let calculatedStats = { revenue: 0, completed: 0, collectable: 0, refunds: 0 };

            if (response.success) {
                const mappedTransactions = (response.transactions || []).map(t => ({
                    id: t.transaction_id || 'N/A',
                    booking_id: t.booking_id,
                    student: t.student_name || 'Unknown',
                    date: t.transaction_date ? new Date(t.transaction_date).toLocaleDateString() : 'N/A',
                    amount: `P ${parseFloat(t.amount || 0).toLocaleString()}`,
                    rawAmount: parseFloat(t.amount || 0),
                    method: t.payment_method || 'Cash',
                    status: t.status || 'Collectable'
                }));
                setTransactions(mappedTransactions.slice(0, 5));
                setAllHistory(mappedTransactions);

                calculatedStats = (response.transactions || []).reduce((acc, t) => {
                    const amt = parseFloat(t.amount || 0) || 0;
                    const status = t.status ? t.status.toLowerCase() : '';

                    if (status === 'success' || status === 'paid') {
                        acc.revenue += amt;
                        acc.completed += 1;
                    } else if (status === 'failed' || status === 'cancelled') {
                        acc.refunds += amt;
                    }
                    // Collectable is now calculated from unpaid bookings
                    return acc;
                }, { revenue: 0, completed: 0, collectable: 0, refunds: 0 });
            }

            const unpaidResponse = await adminAPI.getUnpaidBookings(200); // Fetch more to get accurate total
            if (unpaidResponse.success) {
                setUnpaidBookings(unpaidResponse.bookings);
                const totalCollectable = unpaidResponse.bookings.reduce((sum, booking) => sum + (booking.balance_due || 0), 0);
                calculatedStats.collectable = totalCollectable;
            }
            
            setFinancialStats(calculatedStats);

        } catch (error) {
            console.error('Error fetching transactions:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTransactions();
    }, []);

    const handleDeleteBooking = async (id) => {
        if (!window.confirm('Are you sure you want to delete this booking record?')) return;
        try {
            const response = await adminAPI.deleteBooking(id);
            if (response.success) {
                fetchTransactions();
            }
        } catch (error) {
            console.error('Error deleting booking:', error);
            alert('Failed to delete booking');
        }
    };

    const handleUpdateBooking = async (e) => {
        e.preventDefault();
        setUpdateLoading(true);
        try {
            const response = await adminAPI.updateBookingStatus(selectedBooking.id, selectedBooking.status.toLowerCase());
            if (response.success) {
                setShowEditModal(false);
                fetchTransactions();
            }
        } catch (error) {
            console.error('Error updating booking:', error);
            alert('Failed to update booking');
        } finally {
            setUpdateLoading(false);
        }
    };

    const stats = [
        { label: 'Gross Revenue', value: `P ${financialStats.revenue.toLocaleString()}`, trend: '0%', color: 'blue' },
        { label: 'Completed Payments', value: financialStats.completed.toString(), trend: '0%', color: 'green' },
        { label: 'Collectable', value: `P ${financialStats.collectable.toLocaleString()}`, trend: '0%', color: 'orange' },
        { label: 'Refunds / Cancelled', value: `P ${financialStats.refunds.toLocaleString()}`, trend: '0%', color: 'red' },
    ];

    // Chart data
    // Derived chart data
    const paymentMethods = [
        { name: 'GCash', value: 0, color: '#007dfe' },
        { name: 'StarPay', value: 0, color: '#ef4444' },
        { name: 'Cash', value: 0, color: '#64748b' },
    ];

    // Calculate percentages for pie chart
    const totalPayments = allHistory.filter(t => t.status.toLowerCase() === 'success').length;
    if (totalPayments > 0) {
        allHistory.forEach(t => {
            if (t.status.toLowerCase() !== 'success') return;
            const method = t.method || 'Cash';
            const found = paymentMethods.find(pm => pm.name.toLowerCase() === method.toLowerCase());
            if (found) {
                found.value += 1;
            } else {
                paymentMethods[2].value += 1;
            }
        });
        paymentMethods.forEach(pm => {
            pm.value = Math.round((pm.value / totalPayments) * 100);
        });
    }

    const monthlyData = [
        { name: 'Week 1', amount: 0 },
        { name: 'Week 2', amount: 0 },
        { name: 'Week 3', amount: 0 },
        { name: 'Week 4', amount: 0 },
    ];

    // Simple weekly distribution of successful payments for the bar chart
    allHistory.forEach(t => {
        if (t.status.toLowerCase() !== 'success') return;
        const amt = parseFloat(t.amount.replace('P ', '').replace(',', ''));
        const day = new Date(t.date).getDate();
        if (day <= 7) monthlyData[0].amount += amt;
        else if (day <= 14) monthlyData[1].amount += amt;
        else if (day <= 21) monthlyData[2].amount += amt;
        else monthlyData[3].amount += amt;
    });

    const filteredHistory = allHistory.filter(t => {
        const searchTermLower = (searchTerm || '').toLowerCase();
        const matchesSearch = (t.student || '').toLowerCase().includes(searchTermLower) ||
            (t.id || '').toLowerCase().includes(searchTermLower) ||
            (t.method && t.method.toLowerCase().includes(searchTermLower));
        const matchesStatus = statusFilter === 'All' || t.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const handlePrint = (data = transactions, title = "RECENT TRANSACTIONS") => {
        const printWindow = window.open('', '_blank');
        const timestamp = new Date().toLocaleString();

        const html = `
            <html>
            <head>
                <title>Master Driving School - ${title}</title>
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #334155; }
                    .header { border-bottom: 2px solid #1a4fba; padding-bottom: 20px; margin-bottom: 20px; display: flex; align-items: center; gap: 20px; }
                    .header img { width: 70px; height: 70px; object-fit: cover; border-radius: 12px; }
                    .header-text { text-align: left; }
                    .header h1 { color: #1a4fba; margin: 0; font-size: 22pt; line-height: 1.2; }
                    .header p { color: #64748b; margin: 2px 0; font-size: 10pt; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th { background: #f8fafc; color: #1a4fba; font-weight: bold; border-bottom: 2px solid #e2e8f0; }
                    th, td { padding: 12px; text-align: center; border: 1px solid #f1f5f9; }
                    .amount { font-weight: bold; }
                    .status-success { color: #16a34a; font-weight: bold; }
                    .status-collectable { color: #ea580c; font-weight: bold; }
                    .footer { margin-top: 30px; font-size: 10pt; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 20px; text-align: center; }
                    @media print { .no-print { display: none; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <img src="${logo}" alt="Logo">
                    <div class="header-text">
                        <h1>MASTER DRIVING SCHOOL</h1>
                        <p>${title}</p>
                        <p>Generated on: ${timestamp}</p>
                    </div>
                </div>
                <table>
                    <thead>
                        <tr>
                            ${title.includes('USERS') ? `
                                <th>BOOKING ID</th>
                                <th>STUDENT NAME</th>
                                <th>COURSE</th>
                                <th>AMOUNT DUE</th>
                                <th>STATUS</th>
                                <th>CONTACT</th>
                            ` : `
                                <th>TXN ID</th>
                                <th>STUDENT NAME</th>
                                <th>DATE</th>
                                <th>METHOD</th>
                                <th>AMOUNT</th>
                                <th>STATUS</th>
                            `}
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map(t => title.includes('USERS') ? `
                            <tr>
                                <td>BK-${t.id}</td>
                                <td>${t.student_name}</td>
                                <td>${t.course_name}</td>
                                <td class="amount">P ${parseFloat(t.balance_due).toLocaleString()}</td>
                                <td class="status-collectable">${t.status.toUpperCase()}</td>
                                <td>${t.student_contact || 'N/A'}</td>
                            </tr>
                        ` : `
                            <tr>
                                <td>${t.id}</td>
                                <td>${t.student}</td>
                                <td>${t.date}</td>
                                <td>${t.method}</td>
                                <td class="amount">${t.amount}</td>
                                <td class="${t.status.toLowerCase() === 'success' ? 'status-success' : 'status-collectable'}">${t.status.toUpperCase()}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="footer">
                    Total Transactions: ${data.length} | Master Driving School Management System
                </div>
                <script>
                    window.onload = () => { window.print(); window.close(); }
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
    };

    const handlePrintReceipt = (txn) => {
        const printWindow = window.open('', '_blank');
        const timestamp = new Date().toLocaleString();

        const html = `
            <html>
            <head>
                <title>OFFICIAL RECEIPT - ${txn.id}</title>
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #1e293b; max-width: 500px; margin: 0 auto; border: 1px dashed #cbd5e1; }
                    .header { border-bottom: 2px solid #1a4fba; padding-bottom: 15px; margin-bottom: 20px; display: flex; align-items: center; gap: 15px; }
                    .header img { width: 55px; height: 55px; border-radius: 8px; }
                    .header-text { text-align: left; }
                    .header h1 { font-size: 16pt; color: #1a4fba; margin: 0; line-height: 1.2; }
                    .header p { font-size: 8pt; color: #64748b; margin: 1px 0; }
                    .receipt-title { text-align: center; font-weight: bold; font-size: 14pt; margin: 15px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
                    .info-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 10pt; }
                    .info-label { color: #64748b; }
                    .info-value { font-weight: 600; color: #1e293b; }
                    .amount-box { background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center; border: 1px solid #e2e8f0; }
                    .amount-label { font-size: 9pt; color: #64748b; margin-bottom: 5px; }
                    .amount-value { font-size: 20pt; font-weight: 800; color: #1a4fba; }
                    .status-tag { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 9pt; font-weight: bold; text-transform: uppercase; }
                    .status-success { background: #dcfce7; color: #16a34a; }
                    .status-collectable { background: #ffedd5; color: #ea580c; }
                    .footer { text-align: center; margin-top: 30px; font-size: 8pt; color: #94a3b8; line-height: 1.4; }
                    @media print { body { border: none; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <img src="${logo}" alt="Logo">
                    <div class="header-text">
                        <h1>MASTER DRIVING SCHOOL</h1>
                        <p>Building Champions on the Road</p>
                        <p>Official Billing Document</p>
                    </div>
                </div>
                <div class="receipt-title">OFFICIAL RECEIPT</div>
                <div class="info-row">
                    <span class="info-label">Transaction ID:</span>
                    <span class="info-value">${txn.id}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Student Name:</span>
                    <span class="info-value">${txn.student}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Date:</span>
                    <span class="info-value">${txn.date}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Payment Method:</span>
                    <span class="info-value">${txn.method}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Status:</span>
                    <span class="status-tag ${txn.status.toLowerCase() === 'success' ? 'status-success' : 'status-collectable'}">${txn.status}</span>
                </div>
                <div class="amount-box">
                    <div class="amount-label">TOTAL AMOUNT PAID</div>
                    <div class="amount-value">${txn.amount}</div>
                </div>
                <div class="footer">
                    Thank you for choosing Master Driving School!<br>
                    Keep this receipt for your enrollment records.<br>
                    Generated on ${timestamp}
                </div>
                <script>window.onload = () => { window.print(); window.close(); }</script>
            </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
    };

    const handleExport = (data = transactions, title = "SALES REPORT") => {
        const timestamp = new Date().toLocaleString();

        const tableHtml = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
            <head>
                <meta charset="utf-8">
                <style>
                    body { background-color: #ffffff; margin: 0; padding: 0; }
                    table { border-collapse: collapse; width: 100%; font-family: 'Segoe UI', Arial, sans-serif; background-color: #ffffff; }
                    .title { font-size: 20pt; font-weight: bold; color: #1a4fba; padding: 15px 5px; text-align: left; }
                    .meta { font-size: 11pt; color: #64748b; padding-bottom: 25px; text-align: left; }
                    .column-header th { background-color: #1a4fba !important; color: #ffffff !important; padding: 12px 10px; font-weight: bold; border: 1px solid #cbd5e1; text-align: center; }
                    .row td { padding: 10px; border: 1px solid #e2e8f0; color: #334155; background-color: #ffffff; text-align: center; }
                    .status-success { color: #16a34a; font-weight: bold; }
                    .status-collectable { color: #ea580c; font-weight: bold; }
                </style>
            </head>
            <body>
                <div style="text-align: center; margin-bottom: 20px;">
                    <img src="${logo}" style="width: 80px; height: 80px; border-radius: 12px; margin-bottom: 10px;">
                </div>
                <table>
                    <tr><td colspan="6" class="title">MASTER DRIVING SCHOOL - ${title}</td></tr>
                    <tr><td colspan="6" class="meta">Period: ${period} | Generated on: ${timestamp}</td></tr>
                    <tr><td colspan="6" style="height: 10px; background-color: #ffffff;"></td></tr>
                    <tr class="column-header">
                        ${title.includes('USERS') ? `
                            <th>BOOKING ID</th>
                            <th>STUDENT NAME</th>
                            <th>COURSE</th>
                            <th>AMOUNT DUE</th>
                            <th>STATUS</th>
                            <th>CONTACT</th>
                        ` : `
                            <th>TRANSACTION ID</th>
                            <th>STUDENT NAME</th>
                            <th>DATE</th>
                            <th>METHOD</th>
                            <th>AMOUNT</th>
                            <th>STATUS</th>
                        `}
                    </tr>
                    ${data.map(t => title.includes('USERS') ? `
                        <tr class="row">
                            <td>BK-${t.id}</td>
                            <td>${t.student_name}</td>
                            <td>${t.course_name}</td>
                            <td>P ${parseFloat(t.balance_due).toLocaleString()}</td>
                            <td>${t.status}</td>
                            <td>${t.student_contact || 'N/A'}</td>
                        </tr>
                    ` : `
                        <tr class="row">
                            <td>${t.id}</td>
                            <td>${t.student}</td>
                            <td>${t.date}</td>
                            <td>${t.method}</td>
                            <td>${t.amount}</td>
                            <td>${t.status}</td>
                        </tr>
                    `).join('')}
                    <tr><td colspan="6" style="height: 15px; background-color: #ffffff;"></td></tr>
                    <tr><td colspan="6" style="height: 15px; background-color: #ffffff;"></td></tr>
                    <tr><td colspan="6" style="height: 15px; background-color: #ffffff;"></td></tr>
                    <tr><td colspan="6" style="height: 20px; border-top: 2px solid #1a4fba; padding-top: 10px; font-size: 10pt; color: #94a3b8; text-align: center;">--- Confidential Financial Document ---</td></tr>
                </table>
            </body>
            </html>
        `;

        const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', `MasterSchool_Sales_${new Date().toISOString().slice(0, 10)}.xls`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    return (
        <div className="sale-module">
            <div className="sale-header-section">
                <div className="sale-header">
                    <div className="header-left">
                        <div>
                            <h2>Sales & Financials</h2>
                            <p>Financial overview and transaction history</p>
                        </div>
                    </div>
                    <div className="header-right-actions">
                        <div className="header-controls">
                            <select value={period} onChange={(e) => setPeriod(e.target.value)}>
                                <option>Today</option>
                                <option>This Week</option>
                                <option>This Month</option>
                                <option>This Year</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <div className="revenue-stats-grid">
                {stats.map((stat, idx) => (
                    <div key={idx} className={`rev-stat-card ${stat.color}`}>
                        <div className="rev-info">
                            <span className="label">{stat.label}</span>
                            <div className="value-group">
                                <h3>{stat.value}</h3>
                                <span className={`trend ${stat.trend.startsWith('+') ? 'up' : 'down'}`}>
                                    {stat.trend}
                                </span>
                            </div>
                        </div>
                        <div className="rev-icon">
                            {/* Simple dynamic circle decoration */}
                            <div className="decoration-circle"></div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="sale-charts-row">
                <div className="main-sale-chart">
                    <div className="chart-card">
                        <div className="card-header">
                            <h3>Revenue Overview</h3>
                            <span>Weekly Comparison</span>
                        </div>
                        <div className="chart-body">
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={monthlyData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                    <Tooltip
                                        cursor={{ fill: '#f8fafc' }}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                    />
                                    <Bar dataKey="amount" fill="#1a4fba" radius={[6, 6, 0, 0]} barSize={40} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                <div className="payment-method-chart">
                    <div className="chart-card">
                        <div className="card-header">
                            <h3>Payment Methods</h3>
                            <span>By Usage (%)</span>
                        </div>
                        <div className="chart-body pie-container">
                            <ResponsiveContainer width="100%" height={240}>
                                <PieChart>
                                    <Pie
                                        data={paymentMethods}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {paymentMethods.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="pie-legend">
                                {paymentMethods.map((pm, idx) => (
                                    <div
                                        key={idx}
                                        className="legend-item clickable-pm"
                                        onClick={() => {
                                            setSearchTerm(pm.name);
                                            setShowHistoryModal(true);
                                        }}
                                        title={`Filter by ${pm.name}`}
                                    >
                                        <span className="dot" style={{ background: pm.color }}></span>
                                        <span className="pm-name">{pm.name}</span>
                                        <span className="pm-val">{pm.value}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>



            {/* Recent Transactions Section */}
            <div className="transactions-section">
                <div className="section-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <h3>Recent Successful Transactions</h3>
                        <div className="quick-method-filters">
                            <button className="method-btn gcash" onClick={() => { setSearchTerm('GCash'); setShowHistoryModal(true); }}>
                                <span className="dot"></span>GCash
                            </button>
                            <button className="method-btn starpay" onClick={() => { setSearchTerm('StarPay'); setShowHistoryModal(true); }}>
                                <span className="dot"></span>StarPay
                            </button>
                            <button className="method-btn cash" onClick={() => { setSearchTerm('Cash'); setShowHistoryModal(true); }}>
                                <span className="dot"></span>Cash
                            </button>
                        </div>
                    </div>
                    <div className="section-actions">
                        <button className="export-btn-secondary" onClick={() => handleExport(transactions, "RECENT TRANSACTIONS")}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            Export Excel
                        </button>
                        <button className="export-btn-secondary" onClick={() => handlePrint(transactions, "RECENT TRANSACTIONS")}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                            Print List
                        </button>
                        <button className="view-all-link" onClick={() => setShowHistoryModal(true)}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            View All History
                        </button>
                    </div>
                </div>
                <div className="txn-table-wrapper">
                    <table className="txn-table">
                        <thead>
                            <tr>
                                <th>Transaction ID</th>
                                <th>Student Name</th>
                                <th>Date</th>
                                <th>Method</th>
                                <th>Amount</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'right' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={`skel-${i}`}>
                                        <td><div className="sale-skeleton-cell" style={{ width: '100px' }}></div></td>
                                        <td><div className="sale-skeleton-cell" style={{ width: '120px' }}></div></td>
                                        <td><div className="sale-skeleton-cell" style={{ width: '80px' }}></div></td>
                                        <td><div className="sale-skeleton-cell" style={{ width: '70px', borderRadius: '20px' }}></div></td>
                                        <td><div className="sale-skeleton-cell" style={{ width: '80px' }}></div></td>
                                        <td><div className="sale-skeleton-cell" style={{ width: '70px', borderRadius: '20px' }}></div></td>
                                        <td><div className="sale-skeleton-cell" style={{ width: '30px', margin: '0 0 0 auto' }}></div></td>
                                    </tr>
                                ))
                            ) : transactions.length > 0 ? transactions.map(txn => (
                                <tr key={txn.id}>
                                    <td className="txn-id">{txn.id}</td>
                                    <td className="st-name">{txn.student}</td>
                                    <td>{txn.date}</td>
                                    <td>
                                        <span
                                            className={`method-tag ${txn.method?.toLowerCase().replace(' ', '-')} clickable-tag`}
                                            onClick={() => {
                                                setSearchTerm(txn.method);
                                                setShowHistoryModal(true);
                                            }}
                                            title="Filter by this method"
                                        >
                                            {txn.method || 'Cash'}
                                        </span>
                                    </td>
                                    <td className="amount">{txn.amount}</td>
                                    <td>
                                        <span className={`status-pill ${txn.status?.toLowerCase()}`}>
                                            {txn.status}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <button className="receipt-btn" onClick={() => handlePrintReceipt(txn)} title="Print Receipt">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9V2h12v7"></path><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                                        </button>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="7" className="sale-empty-state">
                                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="9" y1="15" x2="15" y2="15"></line></svg>
                                        <p>No transactions found</p>
                                        <span>Transactions will appear here once students enroll</span>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Unpaid / Collectable Bookings Section */}
            {unpaidBookings.length > 0 && (
                <div className="transactions-section unpaid-section">
                    <div className="section-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <h3>Collectable Bookings</h3>
                            <span className="unpaid-count">{unpaidBookings.length}</span>
                        </div>
                        <div className="section-actions">
                            <button className="export-btn-secondary" onClick={() => handleExport(unpaidBookings, "UNPAID USERS")}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                Export
                            </button>
                            <button className="export-btn-secondary" onClick={() => handlePrint(unpaidBookings, "COLLECTABLE USERS")}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                                Print
                            </button>
                        </div>
                    </div>
                    <div className="txn-table-wrapper">
                        <table className="txn-table">
                            <thead>
                                <tr>
                                    <th>Booking ID</th>
                                    <th>Student Name</th>
                                    <th>Course</th>
                                    <th>Amount Due</th>
                                    <th>Payment Type</th>
                                    <th>Status</th>
                                    <th>Contact</th>
                                </tr>
                            </thead>
                            <tbody>
                                {unpaidBookings.map(b => (
                                    <tr key={b.id}>
                                        <td className="txn-id">BK-{String(b.id).padStart(3, '0')}</td>
                                        <td className="st-name">{b.student_name}</td>
                                        <td>{b.course_name}</td>
                                        <td className="amount">P {parseFloat(b.balance_due).toLocaleString()}</td>
                                        <td>{b.payment_type}</td>
                                        <td>
                                            <span className="status-pill collectable">Collectable</span>
                                        </td>
                                        <td>{b.student_contact || 'N/A'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}


            {/* View All History Modal */}
            {
                showHistoryModal && (
                    <div className="modal-overlay">
                        <div className="modal-container history-modal">
                            <div className="modal-header">
                                <div>
                                    <h2>Complete Transaction History</h2>
                                    <p>Review and filter all recorded payments</p>
                                </div>
                                <button className="close-modal" onClick={() => setShowHistoryModal(false)}>&times;</button>
                            </div>
                            <div className="modal-controls">
                                <div className="search-box">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                    <input
                                        type="text"
                                        placeholder="Search by student or ID..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <div className="filter-group">
                                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                                        <option value="All">All Status</option>
                                        <option value="Success">Success</option>
                                        <option value="Collectable">Collectable</option>
                                    </select>
                                    <button className="print-btn" onClick={() => handlePrint(filteredHistory, "COMPLETE TRANSACTION HISTORY")}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                                        Print History
                                    </button>
                                </div>
                            </div>
                            <div className="modal-body custom-scroll">
                                <table className="txn-table">
                                    <thead>
                                        <tr>
                                            <th>Transaction ID</th>
                                            <th>Student Name</th>
                                            <th>Date</th>
                                            <th>Method</th>
                                            <th>Amount</th>
                                            <th>Status</th>
                                            <th style={{ textAlign: 'right' }}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredHistory.length > 0 ? filteredHistory.map(txn => (
                                            <tr key={txn.id}>
                                                <td className="txn-id">{txn.id}</td>
                                                <td className="st-name">{txn.student}</td>
                                                <td className="date">{txn.date}</td>
                                                <td>
                                                    <span className={`method-tag ${txn.method.toLowerCase().replace(' ', '-')}`}>
                                                        {txn.method}
                                                    </span>
                                                </td>
                                                <td className="amount">{txn.amount}</td>
                                                <td>
                                                    <span className={`status-pill ${txn.status.toLowerCase()}`}>
                                                        {txn.status}
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <button className="receipt-btn" onClick={() => handlePrintReceipt(txn)} title="Print Receipt">
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9V2h12v7"></path><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                                                    </button>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                                                    No transactions found matching your criteria.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <div className="modal-footer">
                                <div className="history-summary">
                                    Total Found: <strong>{filteredHistory.length}</strong>
                                </div>
                                <button className="confirm-btn" onClick={() => setShowHistoryModal(false)}>Close History</button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    );
};

export default SalePayment;
