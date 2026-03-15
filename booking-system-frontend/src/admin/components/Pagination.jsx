import React from 'react';
import './Pagination.css';

/**
 * Reusable pagination bar.
 *
 * Props:
 *   currentPage  – 1-based current page number
 *   totalPages   – total number of pages
 *   onPageChange – callback(newPage)
 *   totalItems   – total item count (optional, for display)
 *   pageSize     – items per page (optional, for display)
 */
const Pagination = ({ currentPage, totalPages, onPageChange, totalItems, pageSize = 10 }) => {
    if (!totalItems || totalItems === 0) return null;

    const from = (currentPage - 1) * pageSize + 1;
    const to = Math.min(currentPage * pageSize, totalItems ?? totalPages * pageSize);

    // Build page number window: always show first, last, current ±1
    const pages = [];
    const addPage = (n) => { if (n >= 1 && n <= totalPages && !pages.includes(n)) pages.push(n); };
    addPage(1);
    addPage(currentPage - 1);
    addPage(currentPage);
    addPage(currentPage + 1);
    addPage(totalPages);
    pages.sort((a, b) => a - b);

    // Insert ellipsis markers
    const items = [];
    let prev = null;
    for (const p of pages) {
        if (prev !== null && p - prev > 1) items.push('...');
        items.push(p);
        prev = p;
    }

    return (
        <div className="pagination-bar">
            {/* Item count info */}
            {totalItems !== undefined && (
                <span className="pagination-info">
                    Showing {from}–{to} of {totalItems}
                </span>
            )}

            {/* Page controls — always visible, disabled when only 1 page */}
            <div className="pagination-controls">
                {/* Prev */}
                <button
                    className={`pg-btn pg-btn--nav${currentPage === 1 ? ' pg-btn--disabled' : ''}`}
                    onClick={() => currentPage > 1 && onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    title="Previous page"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
                </button>

                {items.map((item, i) =>
                    item === '...'
                        ? <span key={`dot-${i}`} className="pg-ellipsis">…</span>
                        : <button
                            key={item}
                            className={`pg-btn${item === currentPage ? ' pg-btn--active' : ''}`}
                            onClick={() => item !== currentPage && onPageChange(item)}
                        >
                            {item}
                        </button>
                )}

                {/* Next */}
                <button
                    className={`pg-btn pg-btn--nav${currentPage === totalPages ? ' pg-btn--disabled' : ''}`}
                    onClick={() => currentPage < totalPages && onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    title="Next page"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </button>
            </div>
        </div>
    );
};

export default Pagination;

