import React, { useState, useMemo, useEffect } from 'react';
import './css/news.css';
import { newsAPI } from '../services/api';
import { useNotification } from '../context/NotificationContext';

const NewsEvents = () => {
    const { showNotification } = useNotification();
    const [newsSearchTerm, setNewsSearchTerm] = useState('');
    const [activeNewsCategory, setActiveNewsCategory] = useState('All');
    const [showNewsModal, setShowNewsModal] = useState(false);
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
    const [fileType, setFileType] = useState(null);

    const [newsData, setNewsData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchInitialData();
    }, []);

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

    const getTagColor = (tag) => {
        switch (tag) {
            case 'EVENT': return { background: 'rgba(22, 163, 74, 0.1)', color: '#16a34a' };
            case 'URGENT': return { background: 'rgba(220, 38, 38, 0.1)', color: '#dc2626' };
            default: return { background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb' };
        }
    };

    const filteredNews = useMemo(() => {
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
            {(activeNewsCategory === 'All' || activeNewsCategory === 'News & Event') && (
                <div className="news-grid-prime">
                    {loading ? (
                        <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem' }}>
                            <div className="loading-spinner-prime"></div>
                            <p style={{ marginTop: '1rem', color: '#94a3b8' }}>Synchronizing with database...</p>
                        </div>
                    ) : filteredNews.filter(n => n.type !== 'Promotional Video').length > 0 ? (
                        filteredNews.filter(n => n.type !== 'Promotional Video').map((news) => (
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
                                    <span className="edit-link" onClick={() => handleOpenModal(news)}>Modify</span>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="no-results" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>
                            No announcements matching your filters.
                        </div>
                    )}
                </div>
            )}

            {/* Combined Videos Section */}
            {(activeNewsCategory === 'All' || activeNewsCategory === 'Promotional Video') && (
                <>
                    <div className="section-header-prime" style={{ marginTop: activeNewsCategory === 'Promotional Video' ? '0' : '4rem' }}>
                        <h2>Promotional Video</h2>
                    </div>

                    <div className="videos-grid-prime">
                        {filteredNews.filter(n => n.type === 'Promotional Video').length > 0 ? (
                            filteredNews.filter(n => n.type === 'Promotional Video').map((video) => (
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
                                        <div className="card-footer-prime" style={{ marginTop: 'auto', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9' }}>
                                            <span className="date-meta">{new Date(video.published_at).toLocaleDateString()} • {video.interactions || '0 views'}</span>
                                            <span className="edit-link" onClick={() => handleOpenModal(video)}>Modify</span>
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
                </>
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
                    <h2>{isEditing ? 'Edit Post' : 'Post New Announcement'}</h2>
                    <button className="close-btn" onClick={onClose}>&times;</button>
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
