import React, { useState, useMemo, useEffect } from 'react';
import './css/news.css';
import { newsAPI, testimonialsAPI } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import Pagination from './components/Pagination';

const NEWS_PAGE_SIZE = 10;

const NewsEvents = () => {
    const { showNotification } = useNotification();
    const [activeMainTab, setActiveMainTab] = useState('news');
    
    // News State
    const [newsSearchTerm, setNewsSearchTerm] = useState('');
    const [activeNewsCategory, setActiveNewsCategory] = useState('All');
    const [showNewsModal, setShowNewsModal] = useState(false);
    const [newsPage, setNewsPage] = useState(1);
    const [videosPage, setVideosPage] = useState(1);
    const [playingVideo, setPlayingVideo] = useState(null);
    const [editingNews, setEditingNews] = useState(null);
    const [newsFormData, setNewsFormData] = useState({
        title: '',
        description: '',
        tag: 'LATEST',
        type: 'News & Event',
        image_url: ''
    });

    const [filePreview, setFilePreview] = useState(null);
    const [newsData, setNewsData] = useState([]);
    const [loading, setLoading] = useState(true);

    // Testimonials State
    const [testimonials, setTestimonials] = useState([]);
    const [loadingTestimonials, setLoadingTestimonials] = useState(false);

    useEffect(() => {
        if (activeMainTab === 'news') {
            fetchInitialData();
        } else if (activeMainTab === 'testimonials') {
            fetchTestimonials();
        }
    }, [activeMainTab]);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const newsRes = await newsAPI.getAll();

            if (newsRes.success) {
                const formattedNews = newsRes.news.map(n => ({
                    ...n,
                    date: new Date(n.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
                    tagColor: getTagColor(n.tag),
                    image_url: n.media_url || n.image_url
                }));
                setNewsData(formattedNews);
            }

        } catch (error) {
            console.error('Fetch error:', error);
            showNotification('Failed to load news data', 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchTestimonials = async () => {
        setLoadingTestimonials(true);
        try {
            const res = await testimonialsAPI.getAll();
            if (res.success) {
                setTestimonials(res.testimonials);
            }
        } catch (error) {
            console.error('Failed to load testimonials', error);
            showNotification('Failed to load testimonials', 'error');
        } finally {
            setLoadingTestimonials(false);
        }
    };

    const handleFeatureTestimonial = async (id) => {
        try {
            const res = await testimonialsAPI.feature(id);
            if (res.success) {
                showNotification(res.message || 'Testimonial updated!', 'success');
                fetchTestimonials(); // Refresh state
            }
        } catch (error) {
            console.error('Failed to feature testimonial:', error);
            showNotification(error.message || 'Failed to update testimonial', 'error');
        }
    };

    const handleOpenModal = (news = null) => {
        if (news) {
            setEditingNews(news);
            setNewsFormData({
                title: news.title,
                description: news.description,
                tag: news.tag,
                type: news.type || 'News & Event',
                image_url: news.image_url || ''
            });
            setFilePreview(news.image_url || null);
        } else {
            setEditingNews(null);
            setNewsFormData({
                title: '',
                description: '',
                tag: 'LATEST',
                type: 'News & Event',
                image_url: ''
            });
            setFilePreview(null);
        }
        setShowNewsModal(true);
    };

    const handleNewsSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingNews) {
                const res = await newsAPI.update(editingNews.id, newsFormData);
                if (res.success) {
                    showNotification('Post updated successfully', 'success');
                    fetchInitialData();
                }
            } else {
                const res = await newsAPI.create(newsFormData);
                if (res.success) {
                    showNotification('Post published successfully', 'success');
                    fetchInitialData();
                }
            }
            setShowNewsModal(false);
        } catch (error) {
            console.error('Submit error:', error);
            showNotification(error.message || 'Error processing request', 'error');
        }
    };

    const handleDeleteNews = async (id) => {
        if (!window.confirm('Are you sure you want to delete this post?')) return;
        try {
            const res = await newsAPI.delete(id);
            if (res.success) {
                showNotification('Post deleted successfully', 'success');
                fetchInitialData();
            }
        } catch (error) {
            showNotification('Failed to delete post', 'error');
        }
    };

    const handleBroadcast = async (id) => {
        if (!window.confirm('Are you sure you want to email this to ALL students? This cannot be undone.')) return;
        try {
            showNotification('Sending emails... Please wait', 'info');
            const res = await newsAPI.broadcast(id);
            if (res.success) {
                showNotification(`Successfully broadcasted to ${res.sentCount} students.`, 'success');
            }
        } catch (error) {
            showNotification('Failed to send broadcast emails', 'error');
            console.error(error);
        }
    };

    const getTagColor = (tag) => {
        switch (tag) {
            case 'EVENT': return { background: 'rgba(22, 163, 74, 0.1)', color: '#16a34a' };
            case 'URGENT': return { background: 'rgba(220, 38, 38, 0.1)', color: '#dc2626' };
            default: return { background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb' };
        }
    };

    const filteredNews = useMemo(() => {
        setNewsPage(1);
        setVideosPage(1);
        return newsData.filter(item => {
            const matchesSearch = item.title.toLowerCase().includes(newsSearchTerm.toLowerCase()) ||
                item.description.toLowerCase().includes(newsSearchTerm.toLowerCase());
            const matchesCategory = activeNewsCategory === 'All' || item.type === activeNewsCategory || (activeNewsCategory === 'News & Event' && (item.type === 'News' || item.type === 'Event' || item.type === 'News & Event'));
            return matchesSearch && matchesCategory;
        });
    }, [newsData, newsSearchTerm, activeNewsCategory]);

    const stats = [
        { label: 'Published News', value: newsData.length, icon: '📰', color: '#eff6ff' },
        { label: 'Upcoming Events', value: newsData.filter(n => n.tag === 'EVENT').length, icon: '📅', color: '#f0fdf4' },
        { label: 'Promotional Videos', value: newsData.filter(n => n.type === 'Promotional Video').length, icon: '🎥', color: '#fff7ed' },
        { label: 'Total Engagement', value: '4.5k', icon: '🔥', color: '#fef2f2' },
    ];

    return (
        <div className="news-view animate-fade-in">
            {/* Top Navigation Tabs */}
            <div className="flex bg-white dark:bg-slate-800 p-1.5 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 w-fit mb-8 items-center gap-1">
                <button
                    onClick={() => setActiveMainTab('news')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm transition-all duration-200 ${
                        activeMainTab === 'news' 
                            ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-800 shadow-sm' 
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 border border-transparent'
                    }`}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                    News & Events
                </button>
                <div className="w-[1px] h-6 bg-gray-200 dark:bg-slate-700 mx-1"></div>
                <button
                    onClick={() => setActiveMainTab('testimonials')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm transition-all duration-200 ${
                        activeMainTab === 'testimonials' 
                            ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-800 shadow-sm' 
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 border border-transparent'
                    }`}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    Testimonials
                </button>
            </div>

            {activeMainTab === 'news' ? (
                <>
                    {/* Stats Overview */}
            <div className="news-header-stats">
                {stats.map((stat, i) => (
                    <div key={i} className="news-stat-card">
                        <div className="stat-icon-box" style={{ background: stat.color }}>
                            <span style={{ fontSize: '1.25rem' }}>{stat.icon}</span>
                        </div>
                        <div className="stat-info">
                            <h4>{stat.label}</h4>
                            <span className="stat-value">{stat.value}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="section-header-prime">
                <h2>News & Events</h2>
                <div className="header-actions-group">
                    <button className="post-btn" onClick={() => handleOpenModal()}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Post New
                    </button>
                </div>
            </div>

            {/* Toolbar Area */}
            <div className="news-toolbar">
                <div className="search-mini">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <input
                        type="text"
                        placeholder="Filter announcements..."
                        value={newsSearchTerm}
                        onChange={(e) => setNewsSearchTerm(e.target.value)}
                    />
                </div>
                <div className="filter-pills">
                    {['All', 'News & Event', 'Promotional Video'].map(cat => (
                        <button
                            key={cat}
                            className={`pill-btn ${activeNewsCategory === cat ? 'active' : ''}`}
                            onClick={() => setActiveNewsCategory(cat)}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* News Grid */}
            {(activeNewsCategory === 'All' || activeNewsCategory === 'News & Event') && (() => {
                const newsItems = filteredNews.filter(n => n.type !== 'Promotional Video');
                const newsTotalPages = Math.ceil(newsItems.length / NEWS_PAGE_SIZE);
                const pagedNews = newsItems.slice((newsPage - 1) * NEWS_PAGE_SIZE, newsPage * NEWS_PAGE_SIZE);
                return (
                <div>
                <div className="news-grid-prime">
                    {loading ? (
                        <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem' }}>
                            <div className="loading-spinner-prime"></div>
                            <p style={{ marginTop: '1rem', color: '#94a3b8' }}>Synchronizing with database...</p>
                        </div>
                    ) : filteredNews.filter(n => n.type !== 'Promotional Video').length > 0 ? (
                        pagedNews.map((news) => (
                            <div key={news.id} className="news-card-prime">
                                <div className="card-actions-top">
                                    <div className="tag-badge" style={{
                                        background: news.tagColor?.background || 'rgba(37, 99, 235, 0.1)',
                                        color: news.tagColor?.color || '#2563eb'
                                    }}>
                                        {news.tag}
                                    </div>
                                    <button className="delete-mini-btn" onClick={() => handleDeleteNews(news.id)} title="Delete Post">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                    </button>
                                </div>
                                <h3>{news.title}</h3>
                                <p>{news.description}</p>
                                <div className="card-footer-prime">
                                    <span className="date-meta">{new Date(news.published_at).toLocaleDateString()} • {news.interactions || '0 views'}</span>
                                    <div style={{ display: 'flex', gap: '15px' }}>
                                        <span className="edit-link" onClick={() => handleBroadcast(news.id)} style={{ color: '#10b981' }}>Email All</span>
                                        <span className="edit-link" onClick={() => handleOpenModal(news)}>Modify</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="no-results" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>
                            No announcements matching your filters.
                        </div>
                    )}
                </div>
                <Pagination
                    currentPage={newsPage}
                    totalPages={newsTotalPages}
                    onPageChange={setNewsPage}
                    totalItems={newsItems.length}
                    pageSize={NEWS_PAGE_SIZE}
                />
                </div>
                );
            })()}

            {/* Combined Videos Section */}
            {(activeNewsCategory === 'All' || activeNewsCategory === 'Promotional Video') && (() => {
                const videoItems = filteredNews.filter(n => n.type === 'Promotional Video');
                const videoTotalPages = Math.ceil(videoItems.length / NEWS_PAGE_SIZE);
                const pagedVideos = videoItems.slice((videosPage - 1) * NEWS_PAGE_SIZE, videosPage * NEWS_PAGE_SIZE);
                return (
                <>
                    <div className="section-header-prime" style={{ marginTop: activeNewsCategory === 'Promotional Video' ? '0' : '4rem' }}>
                        <h2>Promotional Video</h2>
                    </div>

                    <div className="videos-grid-prime">
                        {videoItems.length > 0 ? (
                            pagedVideos.map((video) => (
                                <div key={video.id} className="video-card-prime" style={{ display: 'flex', flexDirection: 'column' }}>
                                    <div className="card-actions-top" style={{ position: 'absolute', top: 10, right: 10, zIndex: 10 }}>
                                        <button className="delete-mini-btn" onClick={() => handleDeleteNews(video.id)} title="Delete Video">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                        </button>
                                    </div>
                                    <div className="thumb-area" style={{ background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)', cursor: 'pointer', overflow: 'hidden' }} onClick={() => setPlayingVideo(video)}>
                                        {video.image_url?.startsWith('data:video') || video.image_url?.match(/\.(mp4|webm|ogg)$/i) ? (
                                            <video
                                                src={video.image_url}
                                                muted
                                                playsInline
                                                className="preview-media-full"
                                                style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0 }}
                                            />
                                        ) : video.image_url ? (
                                            <img
                                                src={video.image_url}
                                                alt="Thumbnail"
                                                className="preview-media-full"
                                                style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0 }}
                                            />
                                        ) : null}
                                        <div className="play-trigger" style={{ position: 'relative', zIndex: 10 }}></div>
                                        {video.duration && <span className="duration-pill" style={{ zIndex: 10 }}>{video.duration}</span>}
                                    </div>
                                    <div className="v-info" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                                        <div className="v-category" style={{ color: video.tagColor?.color || '#2563eb' }}>
                                            {video.tag}
                                        </div>
                                        <h3>{video.title}</h3>
                                        <p>{video.description}</p>
                                        <div className="card-footer-prime" style={{ marginTop: 'auto', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span className="date-meta">{new Date(video.published_at).toLocaleDateString()} • {video.interactions || '0 views'}</span>
                                            <div style={{ display: 'flex', gap: '15px' }}>
                                                <span className="edit-link" onClick={() => handleBroadcast(video.id)} style={{ color: '#10b981' }}>Email All</span>
                                                <span className="edit-link" onClick={() => handleOpenModal(video)}>Modify</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="no-results" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>
                                No promotional videos available yet.
                            </div>
                        )}
                    </div>
                    <Pagination
                        currentPage={videosPage}
                        totalPages={videoTotalPages}
                        onPageChange={setVideosPage}
                        totalItems={videoItems.length}
                        pageSize={NEWS_PAGE_SIZE}
                    />
                </>
                );
            })()}
                </>
            ) : (
                <div className="testimonials-section animate-fade-in">
                    <div className="section-header-prime mb-6 flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Student Testimonials</h2>
                            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Select the best testimonial to feature on the Home Page.</p>
                        </div>
                    </div>

                    {loadingTestimonials ? (
                        <div className="flex justify-center flex-col items-center py-16">
                            <div className="loading-spinner-prime"></div>
                            <p className="mt-4 text-gray-500">Loading testimonials...</p>
                        </div>
                    ) : testimonials.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {testimonials.map(item => (
                                <div key={item.id} className={`bg-white dark:bg-slate-800 border ${item.isFeatured ? 'border-2 border-green-500 dark:border-green-500 shadow-xl' : 'border-gray-200 dark:border-slate-700'} rounded-2xl p-6 relative flex flex-col`}>
                                    {item.isFeatured && (
                                        <div className="absolute top-0 right-0 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-xl">
                                            Currently Featured
                                        </div>
                                    )}
                                    <div className="flex mb-4 items-center gap-3 mt-2">
                                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-300 font-bold text-lg">
                                            {item.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900 dark:text-white leading-tight">{item.name}</h3>
                                            <span className="text-xs text-gray-500 dark:text-gray-400">{item.course}</span>
                                        </div>
                                    </div>
                                    <div className="flex mb-3 text-yellow-500">
                                        {[...Array(5)].map((_, i) => (
                                            <svg key={i} className={`w-4 h-4 ${i < item.rating ? 'fill-current' : 'text-gray-300 dark:text-slate-600'}`} viewBox="0 0 20 20">
                                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                                            </svg>
                                        ))}
                                    </div>
                                    <p className="text-gray-600 dark:text-gray-300 text-sm mb-6 flex-1 italic">"{item.comment}"</p>
                                    
                                    <div className="mt-auto pt-4 border-t border-gray-100 dark:border-slate-700">
                                        <button 
                                            onClick={() => handleFeatureTestimonial(item.id)}
                                            className={`w-full py-2.5 rounded-lg text-sm font-bold transition-all ${
                                                item.isFeatured 
                                                ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100'
                                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg'
                                            }`}
                                        >
                                            {item.isFeatured ? 'Unfeature from Home' : 'Feature This'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-12 text-center shadow-sm">
                            <div className="w-16 h-16 bg-blue-50 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-blue-500 dark:text-slate-400"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No Testimonials Yet</h3>
                            <p className="text-gray-500 dark:text-gray-400">Feedback from your students will appear here once they submit reviews.</p>
                        </div>
                    )}
                </div>
            )}

            {showNewsModal && (
                <NewsModal
                    isOpen={showNewsModal}
                    onClose={() => setShowNewsModal(false)}
                    onSubmit={handleNewsSubmit}
                    formData={newsFormData}
                    setFormData={setNewsFormData}
                    isEditing={!!editingNews}
                    filePreview={filePreview}
                    setFilePreview={setFilePreview}
                />
            )}

            {/* Video Player Modal */}
            {playingVideo && (
                <div className="news-modal-overlay" style={{ zIndex: 100000, background: 'rgba(0,0,0,0.9)' }} onClick={() => setPlayingVideo(null)}>
                    <button
                        onClick={() => setPlayingVideo(null)}
                        style={{ position: 'absolute', top: '20px', right: '30px', background: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', fontSize: '24px', cursor: 'pointer', zIndex: 100001, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        &times;
                    </button>
                    <div className="video-player-container" style={{ width: '90%', maxWidth: '1000px', maxHeight: '80vh', position: 'relative' }} onClick={e => e.stopPropagation()}>
                        {playingVideo.image_url?.startsWith('data:video') || playingVideo.image_url?.match(/\.(mp4|webm|ogg)$/i) ? (
                            <video
                                src={playingVideo.image_url}
                                controls
                                autoPlay
                                style={{ width: '100%', height: '100%', maxHeight: '80vh', borderRadius: '16px', backgroundColor: 'black' }}
                            />
                        ) : (
                            <img
                                src={playingVideo.image_url}
                                alt="Full View"
                                style={{ width: '100%', height: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: '16px' }}
                            />
                        )}
                        <div style={{ marginTop: '1rem', color: 'white' }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{playingVideo.title}</h2>
                            <p style={{ color: '#ccc', marginTop: '5px' }}>{playingVideo.description}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const NewsModal = ({ isOpen, onClose, onSubmit, formData, setFormData, isEditing, filePreview, setFilePreview }) => {
    if (!isOpen) return null;

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFilePreview(reader.result);
                setFormData(prev => ({ ...prev, image_url: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="news-modal-overlay">
            <div className="news-modal-container animate-slide-up">
                <div className="news-modal-header">
                    <div className="modal-header-left">
                        <div className="modal-header-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg>
                        </div>
                        <div>
                            <h2>{isEditing ? 'Edit Post' : 'Post New Announcement'}</h2>
                        </div>
                    </div>
                    <div className="modal-header-right">
                        <button className="close-btn" onClick={onClose}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                </div>
                <form onSubmit={onSubmit}>
                    <div className="news-modal-body">
                        <div className="form-group-lux">
                            <label>Title</label>
                            <input
                                type="text"
                                placeholder="Enter headline title..."
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                required
                            />
                        </div>

                        <div className="form-row-lux">
                            <div className="form-group-lux">
                                <label>Post Category</label>
                                <select
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                >
                                    <option value="News & Event">News & Event</option>
                                    <option value="Promotional Video">Promotional Video</option>
                                </select>
                            </div>
                            <div className="form-group-lux">
                                <label>Priority Tag</label>
                                <select
                                    value={formData.tag}
                                    onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
                                >
                                    <option value="LATEST">LATEST</option>
                                    <option value="URGENT">URGENT</option>
                                    <option value="EVENT">EVENT</option>
                                    <option value="TIPS">TIPS</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-group-lux">
                            <label>Media (Photo or Video)</label>
                            <div className="file-upload-wrapper-lux">
                                <input
                                    type="file"
                                    id="news-file-input"
                                    className="hidden-file-input"
                                    onChange={handleFileChange}
                                    accept="image/*,video/*"
                                />
                                <label htmlFor="news-file-input" className="file-upload-label-lux">
                                    {filePreview ? (
                                        <div className="preview-container-lux">
                                            {formData.image_url?.startsWith('data:video') ? (
                                                <video src={filePreview} className="preview-media" controls />
                                            ) : (
                                                <img src={filePreview} alt="Preview" className="preview-media" />
                                            )}
                                            <div className="change-overlay-lux">Change File</div>
                                        </div>
                                    ) : (
                                        <div className="upload-placeholder-lux">
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                <polyline points="17 8 12 3 7 8"></polyline>
                                                <line x1="12" y1="3" x2="12" y2="15"></line>
                                            </svg>
                                            <span>Choose a photo or video</span>
                                        </div>
                                    )}
                                </label>
                            </div>
                        </div>

                        <div className="form-group-lux">
                            <label>Content Summary</label>
                            <textarea
                                rows="4"
                                placeholder="Write a brief description or full announcement..."
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                required
                            ></textarea>
                        </div>
                    </div>
                    <div className="news-modal-footer">
                        <button type="button" className="cancel-pill" onClick={onClose}>Discard</button>
                        <button type="submit" className="submit-pill">
                            {isEditing ? 'Update Post' : 'Publish Announcement'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default NewsEvents;
