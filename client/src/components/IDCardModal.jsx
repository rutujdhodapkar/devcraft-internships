import React from 'react';
import Lanyard from './Lanyard';

export default function IDCardModal({ user, enrollment, onClose }) {
  if (!enrollment) return null;

  const internId = enrollment.internId || enrollment.id || '—';
  const appliedDate = new Date(enrollment.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2000,
        padding: '2rem',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          border: '3px solid #000',
          boxShadow: '12px 12px 0 #000',
          width: '100%',
          maxWidth: '520px',
          position: 'relative',
          padding: '2rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '0.75rem',
            right: '1rem',
            background: 'none',
            border: 'none',
            fontSize: '1.8rem',
            cursor: 'pointer',
            fontWeight: 900,
            color: '#000',
            lineHeight: 1,
          }}
        >
          &times;
        </button>

        {/* 3D Lanyard Card */}
        <div style={{ width: '300px', height: '420px', marginBottom: '0.5rem' }}>
          <Lanyard
            name={user?.displayName || enrollment.name || 'Student'}
            internId={internId}
            college={enrollment.college || ''}
            city={enrollment.city || ''}
            appliedDate={appliedDate}
            photoURL={user?.photoURL || ''}
          />
        </div>

        {/* Info footer */}
        <div style={{
          borderTop: '2px solid #000',
          paddingTop: '1rem',
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          gap: '2rem',
          flexWrap: 'wrap',
          fontSize: '0.8rem',
          color: '#555',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 800, color: '#000' }}>{enrollment.domain || '—'}</div>
            <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: '#888' }}>Domain</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 800, color: '#000' }}>{enrollment.status || 'Active'}</div>
            <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: '#888' }}>Status</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 800, color: '#000', fontSize: '0.75rem' }}>{internId}</div>
            <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: '#888' }}>Intern ID</div>
          </div>
        </div>
      </div>
    </div>
  );
}
