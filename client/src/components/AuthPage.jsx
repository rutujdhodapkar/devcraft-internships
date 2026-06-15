import React, { useState } from 'react';
import { auth, googleProvider, isFirebaseConfigured } from '../firebase';
import { signInWithPopup } from 'firebase/auth';

export default function AuthPage({ onAuthSuccess, onBackToSite }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleLogin = async () => {
    if (!isFirebaseConfigured || !auth || !googleProvider) {
      setError('Firebase/Google Login is not configured.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await signInWithPopup(auth, googleProvider);
      onAuthSuccess();
    } catch (err) {
      console.error('Google Sign In failed:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="login-root auth-page-wrapper section-padding" style={{ minHeight: 'calc(100vh - 70px)', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
      <div className="login-container" style={{ border: '3px solid #000', padding: '3rem', width: '100%', maxWidth: '480px', boxOffset: '10px 10px 0 #000', backgroundColor: '#fff', position: 'relative' }}>
        <div className="status-bar" style={{ height: '8px', backgroundColor: '#000', position: 'absolute', top: 0, left: 0, right: 0 }} />
        
        <div className="login-header" style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
          <div className="login-wordmark" style={{ fontWeight: 900, fontSize: '1.8rem', letterSpacing: '2px', marginBottom: '0.75rem' }}>DEV/CRAFT</div>
          <h2 className="login-title" style={{ fontSize: '1.6rem', fontWeight: 800, textTransform: 'uppercase', margin: '0.5rem 0' }}>Join Virtual Internship</h2>
          <p className="login-subtitle" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
            Sign in with your Google account to instantly generate your offer letter and access your student project dashboard.
          </p>
        </div>

        {error && <div className="error-msg" style={{ border: '2px solid #EA4335', padding: '0.75rem', color: '#EA4335', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '1.5rem', backgroundColor: '#FFF5F5' }}>{error}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <button
            type="button"
            className="btn-sharp"
            onClick={handleGoogleLogin}
            disabled={loading}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              padding: '1rem',
              fontSize: '1rem',
              fontWeight: 'bold',
              height: '52px',
              backgroundColor: '#000',
              color: '#fff',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#FFF"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#FFF"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FFF"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#FFF"/>
            </svg>
            {loading ? 'Logging in...' : 'Sign In with Google'}
          </button>

          <button
            onClick={onBackToSite}
            className="btn-sharp-outline"
            style={{ width: '100%', height: '52px', fontWeight: 'bold' }}
            type="button"
          >
            Back to Website
          </button>
        </div>
      </div>
    </section>
  );
}
