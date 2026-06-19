import React, { useState } from 'react';
import GooeyNav from './GooeyNav';

export default function AuthPage({ onAuthSuccess, onBackToSite }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      if (window.Clerk?.client?.signIn?.authenticateWithRedirect) {
        await window.Clerk.client.signIn.authenticateWithRedirect({
          strategy: 'oauth_google',
          redirectUrl: window.location.href,
          redirectUrlComplete: window.location.href,
        });
      } else {
        setError('Sign-in is loading. Please try again.');
        setLoading(false);
      }
    } catch (err) {
      console.error('Sign-in failed:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  const navItems = [
    { label: loading ? 'Logging in...' : 'Sign In', onClick: handleLogin },
    { label: 'Back to Website', onClick: onBackToSite },
  ];

  return (
    <section className="login-root auth-page-wrapper section-padding" style={{ minHeight: 'calc(100vh - 70px)', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
      <div className="login-container" style={{ border: '3px solid #000', padding: '2.5rem', width: '100%', maxWidth: '520px', backgroundColor: '#fff', position: 'relative' }}>
        <div className="status-bar" style={{ height: '8px', backgroundColor: '#000', position: 'absolute', top: 0, left: 0, right: 0 }} />
        
        <div className="login-header" style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <div className="login-wordmark" style={{ fontWeight: 900, fontSize: '1.8rem', letterSpacing: '2px', marginBottom: '0.75rem' }}>DEV/CRAFT</div>
          <h2 className="login-title" style={{ fontSize: '1.6rem', fontWeight: 800, textTransform: 'uppercase', margin: '0.5rem 0' }}>Join Virtual Internship</h2>
          <p className="login-subtitle" style={{ fontSize: '0.9rem', color: '#555', lineHeight: '1.5' }}>
            Sign in with your Google account to instantly generate your offer letter and access your student project dashboard.
          </p>
        </div>

        {error && <div className="error-msg" style={{ border: '2px solid #EA4335', padding: '0.75rem', color: '#EA4335', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '1.5rem', backgroundColor: '#FFF5F5' }}>{error}</div>}

        <div style={{
          background: '#000',
          borderRadius: '100vw',
          padding: '0.5rem',
          display: 'flex',
          justifyContent: 'center',
        }}>
          <GooeyNav
            items={navItems}
            particleCount={12}
            particleDistances={[80, 8]}
            particleR={80}
            initialActiveIndex={-1}
            animationTime={500}
            timeVariance={250}
            colors={[1, 2, 3, 1, 2, 3, 1, 4]}
          />
        </div>
      </div>
    </section>
  );
}
