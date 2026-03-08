import React, { useRef } from 'react';
import Papa from 'papaparse';
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
import pptxgen from 'pptxgenjs';
import './css/analytics.css';
import './css/sale.css';

const MasterLogo = '/images/Master-logo.png';

const AnalyticsReports = ({ onNavigate }) => {
    const { theme } = useTheme();
    const { loading, analyticsData, bestSellingCourses, refetch } = useAnalyticsReports();
    const [isSyncing, setIsSyncing] = React.useState(false);
    const fileInputRef = useRef(null);

    const [importedFile, setImportedFile] = React.useState(null);

    const handleRoleClick = (roleType) => {
        if (onNavigate) {
            localStorage.setItem('crmRoleFilter', roleType);
            onNavigate('crm');
        }
    };

    const handleImportClick = () => {
        fileInputRef.current.click();
    };

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                setIsSyncing(true);
                console.log('Imported Data:', results.data);
                // Simulate backend sync delay
                await new Promise(resolve => setTimeout(resolve, 1500));
                await refetch();
                setIsSyncing(false);
                setImportedFile({
                    name: file.name,
                    records: results.data.length
                });

                // Keep the success container visible for 5 seconds
                setTimeout(() => {
                    setImportedFile(null);
                }, 5000);

                // Reset file input so the same file can be uploaded again if needed
                event.target.value = '';
            },
            error: (error) => {
                console.error('Import Error:', error);
                alert('Error parsing CSV file. Please check the format.');
            }
        });
    };

    const handleSync = async () => {
        setIsSyncing(true);
        await refetch();
        setTimeout(() => setIsSyncing(false), 800);
    };

    const handleExportExcel = async () => {
        try {
            const ExcelJS = (await import('exceljs')).default;
            const { saveAs } = await import('file-saver');
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Business Report', {
                pageSetup: { paperSize: 9, orientation: 'portrait' }
            });

            // Set columns
            sheet.columns = [
                { width: 35 },
                { width: 25 },
                { width: 25 },
                { width: 20 }
            ];

            // Fetch and add logo
            const logoRes = await fetch(MasterLogo);
            const logoBlob = await logoRes.blob();
            const logoBuffer = await logoBlob.arrayBuffer();
            const logoId = workbook.addImage({ buffer: logoBuffer, extension: 'png' });

            // A1:D1 header cell
            sheet.mergeCells('A1:D1');
            const titleCell = sheet.getCell('A1');
            titleCell.value = 'MASTER DRIVING SCHOOL - BUSINESS REPORT\nGenerated on: ' + new Date().toLocaleString();
            titleCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF1E3A8A' } };
            titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
            titleCell.border = {
                top: { style: 'medium', color: { argb: 'FF15803D' } },
                bottom: { style: 'thick', color: { argb: 'FF1E3A8A' } }
            };
            sheet.getRow(1).height = 80;

            // Add logos over the merged cell
            sheet.addImage(logoId, {
                tl: { col: 0.2, row: 0.15 },
                ext: { width: 65, height: 65 }
            });
            sheet.addImage(logoId, {
                tl: { col: 3.1, row: 0.15 },
                ext: { width: 65, height: 65 }
            });

            // Spacer
            sheet.addRow([]);

            // Section helper
            const addSection = (title) => {
                const r = sheet.addRow([title, '', '', '']);
                sheet.mergeCells(`A${r.number}:D${r.number}`);
                const c = r.getCell(1);
                c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
                c.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 12 };
                c.alignment = { vertical: 'middle' };
                r.height = 25;
            };

            const applyBorders = (row) => {
                row.eachCell({ includeEmpty: true }, cell => {
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
                    };
                });
            };

            // 1. Performance Summary
            addSection('PERFORMANCE SUMMARY');
            let dataRow = sheet.addRow(['Growth Rate', `${analyticsData?.stats?.growthRate || 0}%`, 'Net revenue change', '']);
            sheet.mergeCells(`C${dataRow.number}:D${dataRow.number}`);
            applyBorders(dataRow);

            dataRow = sheet.addRow(['Retention', `${analyticsData?.stats?.retention || 0}%`, 'Student satisfaction', '']);
            sheet.mergeCells(`C${dataRow.number}:D${dataRow.number}`);
            applyBorders(dataRow);

            dataRow = sheet.addRow(['Monthly Traffic', (analyticsData?.stats?.traffic || 0).toLocaleString(), 'Page views/Inquiries', '']);
            sheet.mergeCells(`C${dataRow.number}:D${dataRow.number}`);
            applyBorders(dataRow);

            sheet.addRow([]);

            // 2. Course Distribution
            addSection('COURSE DISTRIBUTION');
            (analyticsData?.courseDistribution || []).forEach(d => {
                const r = sheet.addRow([d.category, d.count, '', '']);
                sheet.mergeCells(`B${r.number}:D${r.number}`);
                r.getCell(2).alignment = { horizontal: 'left' };
                applyBorders(r);
            });
            sheet.addRow([]);

            // 3. Branch Performance
            addSection('BRANCH PERFORMANCE');
            (analyticsData?.branchPerformance || []).forEach(b => {
                const res = parseFloat(b.revenue) || 0;
                const r = sheet.addRow([b.branch_name, res, '', '']);
                sheet.mergeCells(`B${r.number}:D${r.number}`);
                r.getCell(2).numFmt = '₱#,##0.00';
                applyBorders(r);
            });
            sheet.addRow([]);

            // 4. Monthly Trends
            addSection('MONTHLY TRENDS');
            const hRow = sheet.addRow(['Month', 'Revenue', 'Enrollments', '']);
            hRow.eachCell(c => c.font = { bold: true });
            hRow.getCell(2).alignment = { horizontal: 'right' };
            hRow.getCell(3).alignment = { horizontal: 'right' };
            applyBorders(hRow);

            (analyticsData?.monthlyTrend || []).forEach(t => {
                const res = parseFloat(t.revenue) || 0;
                const r = sheet.addRow([t.month, res, t.added, '']);
                r.getCell(2).numFmt = '₱#,##0.00';
                r.getCell(3).numFmt = '#,##0';
                applyBorders(r);
            });

            // Write and download
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(blob, `Business_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);

        } catch (error) {
            console.error("Export Error:", error);
            alert("An error occurred while generating the Excel report.");
        }
    };

    const handleExportPPT = () => {
        const pptx = new pptxgen();
        const timestamp = new Date().toLocaleString();

        pptx.layout = 'LAYOUT_16x9';
        pptx.author = 'Master Driving School';

        const COLOR_PRIMARY = '1E40AF';
        const COLOR_ACCENT = '3B82F6';
        const COLOR_TEXT = '1E293B';
        const COLOR_BG = 'F8FAFC';
        const CHART_COLORS = ['3B82F6', '10B981', 'F59E0B', 'EF4444', '8B5CF6'];

        const PPT_LOGO = '/images/logo.png';

        const addSlideHeader = (slide, title) => {
            slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.8, fill: { color: COLOR_PRIMARY } });
            slide.addImage({ path: PPT_LOGO, x: 0.2, y: 0.1, w: 2.0, h: 0.6 });
            slide.addText(title, { x: 2.5, y: 0.15, w: 6.5, h: 0.5, fontSize: 24, bold: true, color: 'FFFFFF' });
            slide.addText("MASTER DRIVING SCHOOL", { x: 7.5, y: 0.25, w: 2.2, h: 0.3, fontSize: 10, bold: true, color: 'FFFFFF', align: 'right', transparency: 30 });
        };

        // 1. Title Slide - FIXED DESIGN
        let slide1 = pptx.addSlide();
        slide1.background = { color: COLOR_BG };

        // Add company logo
        slide1.addImage({ path: PPT_LOGO, x: 3.0, y: 0.5, w: 4.0, h: 1.2 });

        // Use transparency instead of opacity
        slide1.addShape(pptx.ShapeType.ellipse, { x: 8.5, y: -0.5, w: 3, h: 3, fill: { color: COLOR_PRIMARY, transparency: 90 } });
        slide1.addShape(pptx.ShapeType.rect, { x: 0, y: 4.5, w: '100%', h: 1.125, fill: { color: COLOR_PRIMARY } });

        slide1.addText("BUSINESS ANALYTICS", {
            x: 0, y: 2.2, w: '100%', h: 1, fontSize: 44, bold: true, color: COLOR_PRIMARY, align: 'center', fontFace: "Arial"
        });
        slide1.addText("QUARTERLY PERFORMANCE REPORT", {
            x: 0, y: 3.1, w: '100%', h: 0.5, fontSize: 18, color: COLOR_ACCENT, align: 'center', letterSpacing: 1
        });

        slide1.addText(`Generated on: ${timestamp}`, {
            x: 0.5, y: 4.7, w: 9, h: 0.3, fontSize: 14, color: "FFFFFF", bold: true, align: 'center'
        });
        slide1.addText("© Master Driving School | Confidential", {
            x: 0.5, y: 5.1, w: 9, h: 0.3, fontSize: 10, color: "FFFFFF", transparency: 20, align: 'center'
        });

        // 2. Performance Summary
        let slide2 = pptx.addSlide();
        addSlideHeader(slide2, "PERFORMANCE OVERVIEW");

        const stats = analyticsData?.stats;
        const summaryData = [
            [{ text: "Core Metric", options: { bold: true, fill: 'F1F5F9' } },
            { text: "Stat", options: { bold: true, fill: 'F1F5F9' } },
            { text: "Significance", options: { bold: true, fill: 'F1F5F9' } }],
            ["Growth Rate", { text: `${stats?.growthRate || 0}%`, options: { color: parseFloat(stats?.growthRate || 0) >= 0 ? '10B981' : 'EF4444', bold: true } }, "Net revenue trajectory"],
            ["Retention", `${stats?.retention || 0}%`, "Repeat business consistency"],
            ["Traffic", (stats?.traffic || 0).toLocaleString(), "Market reach and awareness"],
            ["Active Students", (stats?.activeStudents || 0).toLocaleString(), "Total headcount in system"],
            ["Walk-ins", (stats?.walkIns || 0).toLocaleString(), "On-site conversion success"]
        ];

        slide2.addTable(summaryData, {
            x: 0.5, y: 1.2, w: 9,
            border: { pt: 0.5, color: "CBD5E1" },
            fill: { color: "FFFFFF" },
            fontSize: 14,
            rowH: 0.55,
            colW: [2.5, 2, 4.5]
        });

        // 3. Course Segmentation (Donut)
        let slide3 = pptx.addSlide();
        addSlideHeader(slide3, "COURSE SEGMENTATION");

        const chartDataPie = [{
            name: "Enrollments",
            labels: (analyticsData?.courseDistribution || []).map(d => d.category),
            values: (analyticsData?.courseDistribution || []).map(d => parseInt(d.count))
        }];

        slide3.addChart(pptx.ChartType.pie, chartDataPie, {
            x: 0.5, y: 1.0, w: 9, h: 4.5,
            showLegend: true,
            legendPos: 'r',
            chartColors: CHART_COLORS,
            showValue: true,
            holeSize: 60
        });

        // 4. Branch Performance
        let slide4 = pptx.addSlide();
        addSlideHeader(slide4, "BRANCH REVENUE");

        const chartDataBranch = [{
            name: "Revenue",
            labels: (analyticsData?.branchPerformance || []).map(b => b.branch_name.split(' ').slice(-2).join(' ')),
            values: (analyticsData?.branchPerformance || []).map(b => parseFloat(b.revenue))
        }];

        slide4.addChart(pptx.ChartType.bar, chartDataBranch, {
            x: 0.5, y: 1.2, w: 9, h: 4.0,
            barDir: 'col',
            chartColors: [COLOR_ACCENT],
            showValue: true,
            valGridLine: { color: 'E2E8F0', style: 'dash' }
        });

        // 5. Growth Trend
        let slide5 = pptx.addSlide();
        addSlideHeader(slide5, "STRATEGIC GROWTH");

        const chartDataTrend = [{
            name: "Revenue",
            labels: (analyticsData?.monthlyTrend || []).map(t => t.month),
            values: (analyticsData?.monthlyTrend || []).map(t => parseFloat(t.revenue))
        }];

        slide5.addChart(pptx.ChartType.line, chartDataTrend, {
            x: 0.5, y: 1.2, w: 9, h: 4.0,
            lineSmooth: true,
            chartColors: [COLOR_PRIMARY],
            markerType: 'circle',
            markerSize: 6,
            showValue: true
        });

        // 6. Conclusion - FIXED COORDINATES
        let slide6 = pptx.addSlide();
        slide6.background = { color: COLOR_PRIMARY };
        slide6.addShape(pptx.ShapeType.ellipse, { x: -0.5, y: 4, w: 2, h: 2, fill: { color: 'FFFFFF', transparency: 90 } });

        slide6.addText("End of Report", {
            x: 0, y: 2.2, w: 10, h: 1, fontSize: 42, bold: true, color: "FFFFFF", align: "center"
        });

        slide6.addText(`MASTER DRIVING SCHOOL © ${new Date().getFullYear()}`, {
            x: 0, y: 5.1, w: 10, h: 0.3, fontSize: 11, color: "FFFFFF", align: "center", transparency: 30
        });

        pptx.writeFile({ fileName: `Analytics_Report_${new Date().toISOString().slice(0, 10)}.pptx` });
    };

    return (
        <div className="analytics-view animate-fadeIn">
            <header className="analytics-page-header">
                <div className="header-brand">
                    {/* Brand header removed as requested */}
                </div>
                <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {importedFile && (
                        <div className="import-success-toast" style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: '#ecfdf5',
                            border: '1px solid #10b981',
                            color: '#065f46',
                            padding: '8px 14px',
                            borderRadius: '10px',
                            fontSize: '0.85rem',
                            fontWeight: '500',
                            animation: 'fadeIn 0.3s ease-in-out',
                            boxShadow: '0 2px 5px rgba(16, 185, 129, 0.1)'
                        }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                            <span>Uploaded: <strong style={{ fontWeight: 700 }}>{importedFile.name}</strong> ({importedFile.records} records)</span>
                        </div>
                    )}
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".csv"
                        style={{ display: 'none' }}
                    />
                    <button className={`import-button ${isSyncing ? 'syncing' : ''}`} onClick={handleSync} disabled={isSyncing}>
                        <svg className={isSyncing ? 'animate-spin' : ''} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                        {isSyncing ? 'Updating...' : 'Sync Data'}
                    </button>
                    <button className="import-button" onClick={handleImportClick}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                        Import
                    </button>
                </div>
            </header>

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

            <div className="analytics-main-grid-layout">
                {/* Row 1: Funnel, Distribution, Metrics */}
                <div className="chart-card funnel-card">
                    <div className="chart-header">
                        <div className="header-text">
                            <h3>Conversion Funnel</h3>
                            <p>Student journey tracking</p>
                        </div>
                        <div className="header-badge-live">
                            <span className="badge-dot"></span>
                            LIVE
                        </div>
                    </div>
                    <div className="chart-wrapper" style={{ height: '360px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {loading ? <div className="chart-loading">...</div> : (
                            <div className="funnel-3d-stack">
                                {(analyticsData?.funnel || []).map((stage, index) => {
                                    const total = analyticsData?.funnel?.length || 5;
                                    const stageWidth = 100 - (index * 12);
                                    return (
                                        <div
                                            key={stage.name}
                                            className="funnel-3d-bowl"
                                            style={{
                                                width: `${stageWidth}%`,
                                                zIndex: total - index,
                                                marginBottom: index === total - 1 ? '0' : '-15px'
                                            }}
                                        >
                                            <div className="bowl-top"></div>
                                            <div className="bowl-main">
                                                <div className="bowl-content">
                                                    <span className="bowl-stage-name">{stage.name}</span>
                                                    <span className="bowl-stage-value">{stage.value.toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    <div className="card-footer-action-styled">
                        <button className="export-pill-btn" onClick={handleExportExcel}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            Excel
                        </button>
                        <button className="export-pill-btn" onClick={handleExportPPT}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                            PPT
                        </button>
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
                    <div className="chart-wrapper" style={{ height: '280px' }}>
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
                    <div className="card-footer-action-styled">
                        <button className="export-pill-btn" onClick={handleExportExcel}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            Excel
                        </button>
                        <button className="export-pill-btn" onClick={handleExportPPT}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                            PPT
                        </button>
                    </div>
                </div>

                <div className="chart-card statistics-card insights-card">
                    <div className="chart-header">
                        <div className="header-text">
                            <h3>Performance Metrics</h3>
                            <p>Key business indicators</p>
                        </div>
                        <div className="header-badge active-tag">MONTHLY</div>
                    </div>
                    <div className="insights-content">
                        <div className="insight-item">
                            <div className="insight-label">
                                <span>Growth Rate</span>
                                <span className="trend-pill positive">+{analyticsData?.stats?.growthRate || 0}%</span>
                            </div>
                            <div className="insight-progress-bg-v2">
                                <div className="insight-progress-fill-v2 blue" style={{ width: `${analyticsData?.stats?.growthRate || 0}%` }}></div>
                            </div>
                        </div>

                        <div className="insight-item">
                            <div className="insight-label">
                                <span>Retention</span>
                                <span className="trend-pill success">{analyticsData?.stats?.retention || 0}%</span>
                            </div>
                            <div className="insight-progress-bg-v2">
                                <div className="insight-progress-fill-v2 green" style={{ width: `${analyticsData?.stats?.retention || 0}%` }}></div>
                            </div>
                        </div>

                        <div className="insight-stats-boxes">
                            <div className="mini-box">
                                <span className="box-label">MONTHLY TRAFFIC</span>
                                <span className="box-value">{analyticsData?.stats?.traffic || 0}</span>
                            </div>
                            <div className="mini-box">
                                <span className="box-label">ACTIVE USERS</span>
                                <span className="box-value">{(analyticsData?.stats?.activeStudents || 0).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                    <div className="card-footer-action-styled">
                        <button className="export-pill-btn" onClick={handleExportExcel}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            Excel
                        </button>
                        <button className="export-pill-btn" onClick={handleExportPPT}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                            PPT
                        </button>
                    </div>
                </div>

                {/* Row 2: Revenue Trend, Branch Performance, Enrollment Source */}
                <div className="chart-card trend-card">
                    <div className="chart-header">
                        <div className="header-text">
                            <h3>Revenue Trend (6 Months)</h3>
                            <p>Financial growth trajectory</p>
                        </div>
                    </div>
                    <div className="chart-wrapper" style={{ height: '280px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={analyticsData?.monthlyTrend || []} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                                <defs>
                                    <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9} />
                                        <stop offset="100%" stopColor="#93c5fd" stopOpacity={0.05} />
                                    </linearGradient>
                                </defs>
                                <Legend verticalAlign="top" height={36} />
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                                <XAxis dataKey="month" axisLine={false} tickLine={false} style={{ fontSize: '0.75rem', fill: '#64748b' }} />
                                <YAxis axisLine={false} tickLine={false} style={{ fontSize: '0.75rem', fill: '#64748b' }} />
                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                                <Area name="Revenue" type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} fill="url(#colorTrend)" dot={{ fill: '#3b82f6', r: 4 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="card-footer-action-styled">
                        <button className="export-pill-btn" onClick={handleExportExcel}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path></svg>
                            Excel
                        </button>
                    </div>
                </div>

                <div className="chart-card branch-performance-card">
                    <div className="chart-header">
                        <div className="header-text">
                            <h3>Branch Performance</h3>
                            <p>Regional revenue share</p>
                        </div>
                    </div>
                    <div className="performance-list-compact">
                        {(analyticsData?.branchPerformance || [])
                            .filter(branch => branch.branch_name && branch.branch_name.includes('V-luna'))
                            .map((branch, index) => (
                                <div key={index} className="performance-item-mini">
                                    <div className="branch-info-row">
                                        <span className="branch-name-text">{branch.branch_name}</span>
                                        <span className="branch-value-text">₱{parseFloat(branch.revenue).toLocaleString()}</span>
                                    </div>
                                    <div className="progress-bar-thin">
                                        <div className="progress-bar-fill-thin" style={{ width: `${(parseFloat(branch.revenue) / 20000) * 100}%` }}></div>
                                    </div>
                                </div>
                            ))}
                        {((analyticsData?.branchPerformance || []).filter(branch => branch.branch_name && branch.branch_name.includes('V-luna')).length === 0) && (
                            <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                                No performance data for V-luna branch.
                            </div>
                        )}
                    </div>
                    <div className="card-footer-action-styled">
                        <button className="export-pill-btn" onClick={handleExportExcel}>Excel</button>
                    </div>
                </div>

                <div className="chart-card enrollment-source-card">
                    <div className="chart-header">
                        <div className="header-text">
                            <h3>Student Enrollment</h3>
                            <p>Walk-in & Online Trend</p>
                        </div>
                        <div className="header-badge primary">NEW</div>
                    </div>
                    <div className="chart-wrapper" style={{ height: '280px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={analyticsData?.monthlyTrend || []} margin={{ bottom: 20 }}>
                                <Legend
                                    verticalAlign="top"
                                    height={56}
                                    iconSize={0}
                                    wrapperStyle={{ cursor: 'pointer' }}
                                    onClick={(e) => {
                                        if (e && e.value) {
                                            handleRoleClick(e.value === 'Walk-in' ? 'walkin_student' : 'student');
                                        }
                                    }}
                                    formatter={(value) => {
                                        const isWalkin = value === 'Walk-in';
                                        return (
                                            <div title={`Click to view ${value} students`} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '4px', verticalAlign: 'middle', marginTop: '-10px', marginLeft: '10px', cursor: 'pointer' }}>
                                                <span style={{
                                                    padding: '4px 12px',
                                                    borderRadius: '20px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: '700',
                                                    background: isWalkin ? '#fef3c7' : '#d1fae5',
                                                    color: isWalkin ? '#d97706' : '#10b981',
                                                    letterSpacing: '0.5px',
                                                    lineHeight: '1'
                                                }}>
                                                    {isWalkin ? 'WALK-IN' : 'ONLINE'}
                                                </span>
                                                <span style={{
                                                    padding: '4px 12px',
                                                    borderRadius: '20px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: '700',
                                                    background: isWalkin ? '#fef3c7' : '#d1fae5',
                                                    color: isWalkin ? '#d97706' : '#10b981',
                                                    letterSpacing: '0.5px',
                                                    lineHeight: '1'
                                                }}>
                                                    STUDENT
                                                </span>
                                            </div>
                                        );
                                    }}
                                />
                                <Bar dataKey="walkin" name="Walk-in" fill="#d97706" radius={[6, 6, 0, 0]} barSize={20} onClick={() => handleRoleClick('walkin_student')} style={{ cursor: 'pointer' }} />
                                <Bar dataKey="online" name="Online" fill="#10b981" radius={[6, 6, 0, 0]} barSize={20} onClick={() => handleRoleClick('student')} style={{ cursor: 'pointer' }} />
                                <XAxis dataKey="month" axisLine={false} tickLine={false} style={{ fontSize: '0.75rem' }} />
                                <YAxis hide />
                                <Tooltip
                                    cursor={{ fill: 'transparent' }}
                                    content={({ active, payload, label }) => {
                                        if (active && payload && payload.length) {
                                            const onlineData = payload.find(p => p.dataKey === 'online');
                                            const walkinData = payload.find(p => p.dataKey === 'walkin');
                                            return (
                                                <div style={{
                                                    background: '#ffffff',
                                                    borderRadius: '12px',
                                                    padding: '12px 16px',
                                                    border: '1px solid #e2e8f0',
                                                    boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '8px',
                                                    minWidth: '120px'
                                                }}>
                                                    <div style={{ fontSize: '1rem', fontWeight: '500', color: '#1e293b', textAlign: 'center', marginBottom: '8px' }}>{label}</div>
                                                    {onlineData && (
                                                        <div style={{ fontSize: '0.95rem', fontWeight: '500', color: '#10b981' }}>
                                                            Online : {onlineData.value}
                                                        </div>
                                                    )}
                                                    {walkinData && (
                                                        <div style={{ fontSize: '0.95rem', fontWeight: '500', color: '#d97706' }}>
                                                            Walk-in : {walkinData.value}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="card-footer-action-styled">
                        <button className="export-pill-btn" onClick={handleExportExcel}>Excel</button>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default AnalyticsReports;
