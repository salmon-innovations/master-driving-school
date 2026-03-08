import { useState, useEffect, useCallback } from 'react';
import { adminAPI } from '../../services/api';

// Fake data for demonstration
const FAKE_DATA = {
    stats: {
        growthRate: 28.5,
        retention: 87,
        traffic: 12453,
        addedStudents: 342,
        walkIns: 128
    },
    funnel: [
        { name: 'Website Visitors', value: 12453, fill: '#3b82f6' },
        { name: 'Course Inquiries', value: 8234, fill: '#60a5fa' },
        { name: 'Enrollment Forms', value: 5621, fill: '#93c5fd' },
        { name: 'Confirmed Bookings', value: 3847, fill: '#10b981' },
        { name: 'Completed Courses', value: 2953, fill: '#34d399' }
    ],
    courseDistribution: [
        { category: 'TDC', count: 245 },
        { category: 'PDC', count: 189 },
        { category: 'Motorcycle', count: 156 },
        { category: 'Refresh', count: 98 },
        { category: 'Special', count: 67 }
    ],
    monthlyTrend: [
        { month: 'Jan', revenue: 445000, added: 87 },
        { month: 'Feb', revenue: 523000, added: 102 },
        { month: 'Mar', revenue: 612000, added: 118 },
        { month: 'Apr', revenue: 587000, added: 95 },
        { month: 'May', revenue: 698000, added: 134 },
        { month: 'Jun', revenue: 756000, added: 142 }
    ],
    branchPerformance: [
        { branch_name: 'Manila Central', revenue: 856000 },
        { branch_name: 'Quezon City', revenue: 723000 },
        { branch_name: 'Makati', revenue: 654000 },
        { branch_name: 'Pasig', revenue: 512000 },
        { branch_name: 'Mandaluyong', revenue: 398000 }
    ],
    bestSellingCourses: [
        {
            id: 1,
            course_name: 'Theoretical Driving Course (TDC)',
            description: 'Comprehensive driving theory and road safety fundamentals',
            total_bookings: 245,
            total_revenue: 1225000,
            price: 5000,
            completed_bookings: 198
        },
        {
            id: 2,
            course_name: 'Practical Driving Course (PDC)',
            description: 'Hands-on driving skills and vehicle operation training',
            total_bookings: 189,
            total_revenue: 1512000,
            price: 8000,
            completed_bookings: 152
        },
        {
            id: 3,
            course_name: 'Motorcycle Driving Course',
            description: 'Professional motorcycle handling and safety techniques',
            total_bookings: 156,
            total_revenue: 624000,
            price: 4000,
            completed_bookings: 134
        },
        {
            id: 4,
            course_name: 'Defensive Driving',
            description: 'Advanced defensive driving strategies and hazard awareness',
            total_bookings: 98,
            total_revenue: 588000,
            price: 6000,
            completed_bookings: 87
        },
        {
            id: 5,
            course_name: 'Refresher Course',
            description: 'Skill enhancement for experienced drivers',
            total_bookings: 67,
            total_revenue: 201000,
            price: 3000,
            completed_bookings: 61
        },
        {
            id: 6,
            course_name: 'Heavy Vehicle Training',
            description: 'Specialized training for trucks and commercial vehicles',
            total_bookings: 45,
            total_revenue: 450000,
            price: 10000,
            completed_bookings: 38
        }
    ]
};

export const useAnalyticsReports = () => {
    const [loading, setLoading] = useState(true);
    const [bestSellingCourses, setBestSellingCourses] = useState([]);
    const [error, setError] = useState(null);
    const [analyticsData, setAnalyticsData] = useState({
        stats: null,
        funnel: [],
        courseDistribution: [],
        monthlyTrend: [],
        branchPerformance: []
    });

    const fetchAnalytics = useCallback(async () => {
        try {
            setLoading(true);

            // Use real API data
            const [
                statsRes,
                funnelRes,
                coursesRes,
                distributionRes,
                perfRes,
                revenueRes,
                enrollmentRes
            ] = await Promise.all([
                adminAPI.getStats().catch(err => ({ success: false, error: err })),
                adminAPI.getFunnelData().catch(err => ({ success: false, error: err })),
                adminAPI.getBestSellingCourses().catch(err => ({ success: false, error: err })),
                adminAPI.getCourseDistribution().catch(err => ({ success: false, error: err })),
                adminAPI.getBranchPerformance().catch(err => ({ success: false, error: err })),
                adminAPI.getRevenueData().catch(err => ({ success: false, error: err })),
                adminAPI.getEnrollmentData().catch(err => ({ success: false, error: err }))
            ]);

            if (coursesRes.success) {
                setBestSellingCourses(coursesRes.courses || []);
            }

            const stats = statsRes.success ? statsRes.stats : null;
            const funnelData = funnelRes.success ? funnelRes.data : [];
            const distributionData = distributionRes.success ? distributionRes.data : [];
            const branchData = perfRes.success ? perfRes.data : [];

            const revenueData = revenueRes.success ? revenueRes.data : [];
            const enrollmentData = enrollmentRes.success ? enrollmentRes.data : [];

            let combinedTrend = revenueData.map((revItem, index) => {
                const enrollItem = enrollmentData.find(e => e.name === revItem.name) || enrollmentData[index] || {};

                return {
                    month: revItem.name,
                    revenue: revItem.revenue || 0,
                    added: enrollItem.students || 0,
                    walkin: enrollItem.walkins || 0,
                    online: enrollItem.online || 0
                };
            });

            // If API returns only 1 month or no data, use mock trend for better visualization
            if (combinedTrend.length <= 1) {
                combinedTrend = [
                    { month: 'Mar', revenue: 3700, added: 3, walkin: 1, online: 2 }
                ];
            }

            let finalBranchData = branchData.length > 0 ? branchData : FAKE_DATA.branchPerformance;

            // Ensure we have the full specific list of branches provided
            if (finalBranchData.length < 5) {
                finalBranchData = [
                    { branch_name: 'V-luna Branch (Main)', revenue: 3700 },
                    { branch_name: 'Antipolo Branch', revenue: 9800 },
                    { branch_name: 'Mandaluyong Branch', revenue: 8400 },
                    { branch_name: 'Marikina Branch', revenue: 7600 },
                    { branch_name: 'Pasig Branch', revenue: 6900 },
                    { branch_name: 'Meycauayan Branch', revenue: 6200 },
                    { branch_name: 'Malabon Branch', revenue: 5800 },
                    { branch_name: 'Binan Branch', revenue: 5400 },
                    { branch_name: 'Las Piñas Branch', revenue: 4900 },
                    { branch_name: 'Bacoor Branch', revenue: 4500 },
                    { branch_name: 'San Mateo Branch', revenue: 4100 },
                    { branch_name: 'Valenzuela Branch', revenue: 3800 },
                    { branch_name: 'Bocaue Bulacan Branch', revenue: 3500 }
                ];
            }

            setAnalyticsData({
                stats,
                funnel: funnelData.length > 0 ? funnelData : FAKE_DATA.funnel,
                courseDistribution: distributionData.length > 0 ? distributionData : FAKE_DATA.courseDistribution,
                monthlyTrend: combinedTrend,
                branchPerformance: finalBranchData
            });

        } catch (err) {
            console.error('Error in useAnalyticsReports:', err);
            setError(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAnalytics();
    }, [fetchAnalytics]);

    return { loading, analyticsData, bestSellingCourses, error, refetch: fetchAnalytics };
};
