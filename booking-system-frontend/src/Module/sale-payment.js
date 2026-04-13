import React, { useState, useEffect } from 'react';
import './css/sale.css';
import logo from '../image/logo.jpg';
import { adminAPI } from '../services/api';
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
    Pie,
    FunnelChart,
    Funnel,
    LabelList
} from 'recharts';

const funnelData = [
    { value: 1000, name: 'Visitors', fill: '#1a4fba' },
    { value: 750, name: 'Inquiries', fill: '#3b82f6' },
    { value: 500, name: 'Enrolled', fill: '#60a5fa' },
    { value: 380, name: 'Active', fill: '#93c5fd' },
    { value: 200, name: 'Graduates', fill: '#bfdbfe' },
];

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
        pending: 0,
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
            if (response.success) {
                if (!response.transactions || response.transactions.length === 0) {
                    // Inject diverse mock data if none exists
                    response.transactions = [
                        { transaction_id: 'TXN-2026-001', student_name: 'John Doe', transaction_date: new Date().toISOString(), amount: 2500, payment_method: 'GCash', status: 'success' },
                        { transaction_id: 'TXN-2026-002', student_name: 'Jane Smith', transaction_date: new Date().toISOString(), amount: 1500, payment_method: 'GCash', status: 'success' },
                        { transaction_id: 'TXN-2026-003', student_name: 'Juan Dela Cruz', transaction_date: new Date().toISOString(), amount: 3000, payment_method: 'Cash', status: 'success' },
                        { transaction_id: 'TXN-2026-004', student_name: 'Maria Clara', transaction_date: new Date().toISOString(), amount: 2500, payment_method: 'GCash', status: 'success' }
                    ];
                }

                const mappedTransactions = response.transactions.map(t => ({
                    id: t.transaction_id || 'N/A',
                    booking_id: t.booking_id,
                    student: t.student_name || 'Unknown',
                    date: t.transaction_date ? new Date(t.transaction_date).toLocaleDateString() : 'N/A',
                    amount: `P ${parseFloat(t.amount || 0).toLocaleString()}`,
                    method: t.payment_method || 'Cash',
                    status: t.status || 'Pending'
                }));
                setTransactions(mappedTransactions.slice(0, 5));
                setAllHistory(mappedTransactions);

                const stats = response.transactions.reduce((acc, t) => {
                    const amt = parseFloat(t.amount || 0) || 0;
                    const status = t.status ? t.status.toLowerCase() : '';
                    if (status === 'success') {
                        acc.revenue += amt;
                        acc.completed += 1;
                    } else if (status === 'pending') {
                        acc.pending += amt;
                    } else if (status === 'failed' || status === 'cancelled') {
                        acc.refunds += amt;
                    }
                    return acc;
                }, { revenue: 0, completed: 0, pending: 0, refunds: 0 });
                setFinancialStats(stats);
            }

            const unpaidResponse = await adminAPI.getUnpaidBookings(10);
            if (unpaidResponse.success) {
                setUnpaidBookings(unpaidResponse.bookings);
            }
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
            const response = await adminAPI.updateBookingStatus(selectedBooking.id, {
                status: selectedBooking.status
            });
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
        { label: 'Pending Collections', value: `P ${financialStats.pending.toLocaleString()}`, trend: '0%', color: 'orange' },
        { label: 'Refunds / Cancelled', value: `P ${financialStats.refunds.toLocaleString()}`, trend: '0%', color: 'red' },
    ];

    // Chart data
    // Derived chart data
    const paymentMethods = [
        { name: 'GCash', value: 0, color: '#007dfe' },
        { name: 'Cash', value: 0, color: '#6366f1' },
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
                    .status-pending { color: #ea580c; font-weight: bold; }
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
                                <td class="amount">P ${parseFloat(t.total_amount).toLocaleString()}</td>
                                <td class="status-pending">${t.status.toUpperCase()}</td>
                                <td>${t.student_contact || 'N/A'}</td>
                            </tr>
                        ` : `
                            <tr>
                                <td>${t.id}</td>
                                <td>${t.student}</td>
                                <td>${t.date}</td>
                                <td>${t.method}</td>
                                <td class="amount">${t.amount}</td>
                                <td class="${t.status.toLowerCase() === 'success' ? 'status-success' : 'status-pending'}">${t.status.toUpperCase()}</td>
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
                <title>Acknowledgement Receipt - ${txn.id}</title>
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
                    .status-pending { background: #ffedd5; color: #ea580c; }
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
                <div class="receipt-title">Acknowledgement Receipt</div>
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
                    <span class="status-tag ${txn.status.toLowerCase() === 'success' ? 'status-success' : 'status-pending'}">${txn.status}</span>
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
                    .status-pending { color: #ea580c; font-weight: bold; }
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
                            <td>P ${parseFloat(t.total_amount).toLocaleString()}</td>
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
                </table>
            </body>
            </html>
        `;

        const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', `MasterSchool_${title.replace(' ', '_')}_${new Date().toISOString().slice(0, 10)}.xls`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    return (
        <div className="sale-module">
            <div className="sale-header">
                <div>
                    <h2>Sales & Financials</h2>
                    <p>Financial overview and transaction history</p>
                </div>
                <div className="header-controls">
                    <select value={period} onChange={(e) => setPeriod(e.target.value)}>
                        <option>Today</option>
                        <option>This Week</option>
                        <option>This Month</option>
                        <option>This Year</option>
                    </select>
                    <button className="export-btn-secondary" onClick={handleExport}>
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

            <div className="analytics-info-grid">
                <div className="premium-stat-card blue">
                    <div className="card-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
                    </div>
                    <span className="label">Growth Rate</span>
                    <div className="value">+12.5%</div>
                    <div className="trend-box">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 11 12 6 7 11"></polyline><polyline points="17 18 12 13 7 18"></polyline></svg>
                        <span>Above target</span>
                    </div>
                </div>

                <div className="premium-stat-card green">
                    <div className="card-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                    </div>
                    <span className="label">Student Retention</span>
                    <div className="value">94.2%</div>
                    <div className="trend-box">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                        <span>Top 10% Industry</span>
                    </div>
                </div>

                <div className="premium-stat-card orange">
                    <div className="card-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    </div>
                    <span className="label">Monthly Traffic</span>
                    <div className="value">12.8k</div>
                    <div className="trend-box">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        <span>Daily average: 420</span>
                    </div>
                </div>
            </div>

            <div className="chart-card glass-container" style={{ width: '100%', marginBottom: '35px', borderRadius: '32px', padding: '35px', boxShadow: '0 20px 50px rgba(0,0,0,0.08)' }}>
                <div className="card-header" style={{ marginBottom: '30px', borderLeft: '4px solid #1a4fba', paddingLeft: '20px' }}>
                    <h3 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>Enrollment Funnel</h3>
                    <span style={{ fontSize: '0.95rem', color: '#64748b', marginTop: '5px' }}>Conversion rates across student acquisition stages</span>
                </div>
                <div className="chart-body" style={{ height: '400px', padding: '10px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <FunnelChart>
                            <Tooltip
                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 15px 35px rgba(0,0,0,0.1)', padding: '15px' }}
                                itemStyle={{ fontWeight: '700' }}
                            />
                            <Funnel
                                dataKey="value"
                                data={funnelData}
                                isAnimationActive
                                labelLine={true}
                            >
                                {funnelData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={['#1a4fba', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'][index % 5]} />
                                ))}
                                <LabelList position="right" fill="#475569" stroke="none" dataKey="name" fontSize={13} fontWeight="700" />
                            </Funnel>
                        </FunnelChart>
                    </ResponsiveContainer>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '30px', padding: '20px', background: 'rgba(26, 79, 186, 0.03)', borderRadius: '20px' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ color: '#1a4fba', fontWeight: '800', fontSize: '1.1rem' }}>24%</div>
                        <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase' }}>Overall Conv.</div>
                    </div>
                    <div style={{ borderLeft: '1px solid #e2e8f0' }}></div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ color: '#10b981', fontWeight: '800', fontSize: '1.1rem' }}>14.2s</div>
                        <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase' }}>Avg. Lead Time</div>
                    </div>
                    <div style={{ borderLeft: '1px solid #e2e8f0' }}></div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ color: '#f59e0b', fontWeight: '800', fontSize: '1.1rem' }}>+5.2%</div>
                        <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase' }}>WoW Growth</div>
                    </div>
                </div>
            </div>

            <div className="revenue-stats-grid" style={{ marginBottom: '35px' }}>
                {stats.map((stat, idx) => (
                    <div key={idx} className={`rev-stat-card ${stat.color} glass-container`}>
                        <div className="rev-info">
                            <span className="label" style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>{stat.label}</span>
                            <div className="value-group" style={{ marginTop: '10px' }}>
                                <h3 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#1e293b' }}>{stat.value}</h3>
                                <span className={`trend ${stat.trend.startsWith('+') ? 'up' : 'down'}`} style={{ fontSize: '0.7rem', padding: '4px 10px' }}>
                                    {stat.trend}
                                </span>
                            </div>
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







            <div className="sale-charts-row" style={{ marginTop: '30px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px' }}>
                <div className="chart-card">
                    <div className="card-header">
                        <h3>Best Selling Courses</h3>
                        <span>Popular Training Packages</span>
                    </div>
                    <div className="chart-body" style={{ height: '300px' }}>
                        <div className="top-courses-list" style={{ padding: '10px 0' }}>
                            {[
                                { name: 'TDC - Online Course', count: 142, growth: '+12%', color: '#1a4fba' },
                                { name: 'PDC - Manual (15hrs)', count: 98, growth: '+8%', color: '#3b82f6' },
                                { name: 'PDC - Automatic (15hrs)', count: 76, growth: '+15%', color: '#60a5fa' },
                                { name: 'Refresher Course', count: 45, growth: '+2%', color: '#93c5fd' },
                                { name: 'Theoretical Driving (8hrs)', count: 32, growth: '-3%', color: '#bfdbfe' },
                            ].map((course, i) => (
                                <div key={i} className="course-item" style={{ display: 'flex', alignItems: 'center', marginBottom: '18px', gap: '15px' }}>
                                    <div className="course-rank" style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: '700', color: '#64748b' }}>{i + 1}</div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                            <span style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-color)' }}>{course.name}</span>
                                            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{course.count} Sales</span>
                                        </div>
                                        <div className="progress-bar" style={{ height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${(course.count / 150) * 100}%`, background: course.color, borderRadius: '3px' }}></div>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '0.8rem', fontWeight: '600', color: course.growth.startsWith('+') ? '#16a34a' : '#ef4444' }}>{course.growth}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="chart-card">
                    <div className="card-header">
                        <h3>Revenue by Branch</h3>
                        <span>Location Performance Distribution</span>
                    </div>
                    <div className="chart-body" style={{ height: '300px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart layout="vertical" data={[
                                { name: 'Lipa Main', value: 850000 },
                                { name: 'Batangas', value: 620000 },
                                { name: 'Tanauan', value: 480000 },
                                { name: 'Lemery', value: 390000 },
                                { name: 'Calamba', value: 250000 },
                            ]} margin={{ left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} width={80} />
                                <Tooltip
                                    cursor={{ fill: 'transparent' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    formatter={(value) => [`P ${value.toLocaleString()}`, 'Revenue']}
                                />
                                <Bar dataKey="value" fill="#1a4fba" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginTop: '10px' }}>
                            <div style={{ fontSize: '0.8rem', color: '#64748b' }}><span style={{ color: '#1a4fba', fontWeight: 'bold' }}>●</span> Highest: Lipa Main</div>
                            <div style={{ fontSize: '0.8rem', color: '#64748b' }}><span style={{ color: '#3b82f6', fontWeight: 'bold' }}>●</span> Lowest: Calamba</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="sale-charts-row" style={{ marginTop: '30px' }}>
                <div className="chart-card" style={{ flex: 1, minWidth: '300px' }}>
                    <div className="card-header">
                        <h3>Monthly Revenue Trends</h3>
                        <span>Overall Financial Growth</span>
                    </div>
                    <div className="chart-body" style={{ height: '300px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                <Bar dataKey="amount" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="chart-card" style={{ flex: 1, minWidth: '300px' }}>
                    <div className="card-header">
                        <h3>Monthly Enrollments</h3>
                        <span>Student Acquisition Rate</span>
                    </div>
                    <div className="chart-body" style={{ height: '300px' }}>
                        <ResponsiveContainer width="100%" height="100%">
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
                        <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.9rem', marginTop: '10px' }}>
                            Data derived from current monthly transactions
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
                            {transactions.length > 0 ? transactions.map(txn => (
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
                                    <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                                        No recent transactions found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>


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
                                        <option value="Pending">Pending</option>
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
        </div >
    );
};

export default SalePayment;
