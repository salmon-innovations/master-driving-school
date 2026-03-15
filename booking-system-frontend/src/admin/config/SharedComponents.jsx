import React from 'react';

export const LoadingPlaceholder = ({ count }) => (
    <>
        {[...Array(count)].map((_, i) => (
            <div key={i} className="cfg-skeleton">
                <div className="cfg-skel-line h36" />
                <div className="cfg-skel-line" />
                <div className="cfg-skel-line w60" />
                <div className="cfg-skel-line w40" />
            </div>
        ))}
    </>
);

export const EmptyState = ({ title, message, icon }) => (
    <div className="cfg-empty cfg-section-enter">
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25">
            {icon}
        </svg>
        <h3>{title}</h3>
        <p>{message}</p>
    </div>
);
