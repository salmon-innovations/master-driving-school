import React, { useState } from 'react';
import './css/sale.css';
import logo from '../image/logo.jpg';
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

    // Mock data for sales overview
    const stats = [
        { label: 'Gross Revenue', value: 'P 124,500', trend: '+12.5%', color: 'blue' },
        { label: 'Completed Payments', value: '42', trend: '+8%', color: 'green' },
        { label: 'Pending Collections', value: 'P 18,200', trend: '-2.4%', color: 'orange' },
        { label: 'Refunds / Cancelled', value: 'P 4,500', trend: '+0.5%', color: 'red' },
    ];

    // Chart data
    const monthlyData = [
        { name: 'Week 1', amount: 25000 },
        { name: 'Week 2', amount: 32000 },
        { name: 'Week 3', amount: 41000 },
        { name: 'Week 4', amount: 26500 },
    ];

    const paymentMethods = [
        { name: 'GCash', value: 65, color: '#007dfe' },
        { name: 'StarPay', value: 25, color: '#ef4444' },
        { name: 'Others', value: 10, color: '#64748b' },
    ];

    // Recent Transactions
    const transactions = [
        { id: 'TXN-9821', student: 'Juan Dela Cruz', date: '2024-03-05', amount: 'P 2,500', method: 'GCash', status: 'Success' },
        { id: 'TXN-9822', student: 'Maria Santos', date: '2024-03-05', amount: 'P 5,000', method: 'StarPay', status: 'Success' },
        { id: 'TXN-9823', student: 'Jose Rizal', date: '2024-03-04', amount: 'P 2,500', method: 'StarPay', status: 'Success' },
        { id: 'TXN-9824', student: 'Andres Bonifacio', date: '2024-03-04', amount: 'P 4,500', method: 'GCash', status: 'Pending' },
        { id: 'TXN-9825', student: 'Emilio Aguinaldo', date: '2024-03-03', amount: 'P 2,500', method: 'StarPay', status: 'Success' },
    ];

    const allHistory = [
        ...transactions,
        { id: 'TXN-9826', student: 'Antonio Luna', date: '2024-03-02', amount: 'P 3,000', method: 'StarPay', status: 'Success' },
        { id: 'TXN-9827', student: 'Melchora Aquino', date: '2024-03-01', amount: 'P 2,500', method: 'GCash', status: 'Success' },
        { id: 'TXN-9828', student: 'Gabriela Silang', date: '2024-02-28', amount: 'P 5,000', method: 'StarPay', status: 'Success' },
        { id: 'TXN-9829', student: 'Marcelo H. Del Pilar', date: '2024-02-27', amount: 'P 2,500', method: 'StarPay', status: 'Pending' },
        { id: 'TXN-9830', student: 'Graciano Lopez Jaena', date: '2024-02-26', amount: 'P 4,500', method: 'GCash', status: 'Success' },
    ];

    const filteredHistory = allHistory.filter(t => {
        const matchesSearch = t.student.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.id.toLowerCase().includes(searchTerm.toLowerCase());
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
                            <th>TXN ID</th>
                            <th>STUDENT NAME</th>
                            <th>DATE</th>
                            <th>METHOD</th>
                            <th>AMOUNT</th>
                            <th>STATUS</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map(t => `
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

    const handleExport = () => {
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
                    <tr><td colspan="6" class="title">MASTER DRIVING SCHOOL - SALES REPORT</td></tr>
                    <tr><td colspan="6" class="meta">Period: ${period} | Generated on: ${timestamp}</td></tr>
                    <tr><td colspan="6" style="height: 10px; background-color: #ffffff;"></td></tr>
                    <tr class="column-header">
                        <th>TRANSACTION ID</th>
                        <th>STUDENT NAME</th>
                        <th>DATE</th>
                        <th>METHOD</th>
                        <th>AMOUNT</th>
                        <th>STATUS</th>
                    </tr>
                    ${transactions.map(t => `
                        <tr class="row">
                            <td>${t.id}</td>
                            <td>${t.student}</td>
                            <td>${t.date}</td>
                            <td>${t.method}</td>
                            <td>${t.amount}</td>
                            <td class="${t.status.toLowerCase() === 'success' ? 'status-success' : 'status-pending'}">${t.status.toUpperCase()}</td>
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
                    <button className="print-report-btn" onClick={handleExport}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                        Financial Report
                    </button>
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
                                    <div key={idx} className="legend-item">
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

            <div className="transactions-section">
                <div className="section-header">
                    <h3>Recent Transactions</h3>
                    <div className="section-actions">
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
                            {transactions.map(txn => (
                                <tr key={txn.id}>
                                    <td className="txn-id">{txn.id}</td>
                                    <td className="st-name">{txn.student}</td>
                                    <td className="date">{txn.date}</td>
                                    <td>
                                        <span className={`method-tag ${txn.method.toLowerCase()}`}>
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
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* View All History Modal */}
            {showHistoryModal && (
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
            )}
        </div>
    );
};

export default SalePayment;
