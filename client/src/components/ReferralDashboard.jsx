import React, { useEffect, useState } from 'react';
import { fetchReferralDashboardData, fetchSiteNotices } from '../services/data';
import { notify } from '../services/notify';
import EarnSection from './EarnSection';

export default function ReferralDashboard({ user, userProfile, onBackClick, standalone }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [code, setCode] = useState(null);
  const [siteNotices, setSiteNotices] = useState([]);

  const loadDashboard = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const dashboardData = await fetchReferralDashboardData(user.uid);
      if (!dashboardData?.code) {
        setError('You do not have a referral code yet. Create one from the Earn section to get started.');
        setLoading(false);
        return;
      }
      setCode(dashboardData.code);
      setData(dashboardData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [user]);

  useEffect(() => {
    fetchSiteNotices()
      .then((notices) => setSiteNotices(notices.filter((n) => n.context === "all" || n.context === "referral")))
      .catch(() => setSiteNotices([]));
  }, []);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/?ref=${code}`);
    notify('Referral link copied!', 'success');
  };

  const rpc = data?.rewardPerCompletion || 20;
  const mb = data?.milestoneBonus || 1000;
  const mc = data?.milestoneCount || 50;
  const earnings = (data?.completedInterns || 0) * rpc + Math.floor((data?.completedInterns || 0) / mc) * mb;

  return (
    <section style={{ background: '#f8f8f8', minHeight: '100vh' }}>
      {/* Top Header Bar */}
      <div style={{ background: '#000', color: '#fff', padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontWeight: 900, fontSize: '1.1rem', letterSpacing: '1px' }}>DEV/CRAFT</span>
          <span style={{ opacity: 0.6, fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Refer & Earn Dashboard</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {user?.photoURL && (
            <img src={user.photoURL} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%', border: '2px solid #fff' }} />
          )}
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{user?.displayName || user?.email}</span>
          <button onClick={onBackClick} style={{ background: 'transparent', border: '1px solid #fff', color: '#fff', padding: '0.3rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
            {standalone ? 'Home' : '← Back'}
          </button>
        </div>
      </div>

      {/* Site Notices */}
      {siteNotices.length > 0 && siteNotices.map((n) => (
        <div key={n.id} style={{ background: '#FFF8E1', borderBottom: '2px solid #FBBC05', padding: '0.5rem 1.5rem', fontSize: '0.82rem', color: '#7a5c00', textAlign: 'center' }}>
          {n.title && <strong>{n.title}: </strong>}{n.text}
        </div>
      ))}

      {/* Main Content */}
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem 1rem 4rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
          <div>
            <span style={{ display: 'inline-block', backgroundColor: '#000', color: '#fff', fontSize: '0.7rem', fontWeight: 900, letterSpacing: '2px', padding: '0.3rem 0.75rem', marginBottom: '0.75rem', textTransform: 'uppercase' }}>
              REFERRAL DASHBOARD
            </span>
            <h2 style={{ fontSize: '2rem', fontWeight: 900, textTransform: 'uppercase', margin: '0 0 0.25rem' }}>
              Your Referral Hub
            </h2>
            <p style={{ color: '#666', fontSize: '0.93rem', margin: 0 }}>
              Track your referral performance and earnings in real time.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-sharp-outline" onClick={() => { window.location.href = '/'; }} style={{ padding: '0.6rem 1.25rem', fontSize: '0.85rem', fontWeight: 700 }}>
              Explore Internships
            </button>
          </div>
        </div>

        {!user && (
          <div style={{ border: '2px solid #000', padding: '3rem 2rem', background: '#fff', boxShadow: '6px 6px 0 #000', textAlign: 'center', marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 900, marginBottom: '0.75rem' }}>Sign In Required</h3>
            <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Sign in with Google to access your Refer & Earn dashboard and track your earnings.</p>
            <button className="btn-sharp" onClick={() => window.location.href = '/'} style={{ padding: '0.75rem 2rem', fontSize: '1rem', fontWeight: 700 }}>
              Go to Home & Sign In
            </button>
          </div>
        )}

        {error && !error.includes('do not have a referral code') && (
          <div style={{ border: '2px solid #EA4335', padding: '1.5rem', backgroundColor: '#FFF5F5', color: '#EA4335', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '2rem', textAlign: 'center' }}>
            {error}
          </div>
        )}

        {error && error.includes('do not have a referral code') && (
          <div style={{ marginBottom: '2rem', border: '2px solid #000', padding: '2rem', background: '#fff', boxShadow: '6px 6px 0 #000' }}>
            <EarnSection user={user} userProfile={userProfile} onLoginClick={() => window.location.href = '/'} />
          </div>
        )}

        {loading && user ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#888', fontSize: '1.1rem' }}>
            Loading your referral dashboard...
          </div>
        ) : data ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Referral Code & Share */}
            <div style={{ border: '2px solid #000', background: '#fff', boxShadow: '6px 6px 0 #000', padding: '1.5rem 2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#888', marginBottom: '0.25rem' }}>Your Referral Code</div>
                  <div style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '4px', color: '#000' }}>{data.code}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#888', marginBottom: '0.25rem' }}>Share Link</div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <code style={{ fontSize: '0.85rem', background: '#f5f5f5', padding: '0.4rem 0.7rem', border: '1px solid #ddd', userSelect: 'all' }}>
                      {window.location.origin}/?ref={data.code}
                    </code>
                    <button className="btn-sharp" onClick={handleCopyLink} style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}>
                      Copy
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Earnings Banner */}
            <div style={{ border: '2px solid #000', background: 'linear-gradient(135deg, #EBFCEF, #D4EDDA)', padding: '1.25rem 1.5rem' }}>
              <div style={{ fontSize: '0.85rem', lineHeight: 1.6, color: '#333' }}>
                Earn <strong>₹{rpc}</strong> for each referred intern who completes their internship, plus a <strong>₹{mb.toLocaleString()}</strong> bonus at {mc} completions.
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 900, marginTop: '0.5rem', color: '#1B7A3D' }}>
                Estimated earnings: ₹{earnings.toLocaleString()}
              </div>
            </div>

            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
              <StatBox label="Link Visits" value={data.totalVisits || 0} />
              <StatBox label="Total Logins" value={data.totalLogins || 0} />
              <StatBox label="Enrolled Interns" value={data.totalEnrolled || 0} color="#FBBC05" />
              <StatBox label="Completed" value={data.completedInterns || 0} color="#34A853" />
            </div>

            {/* Enrolled Interns Table */}
            {data.enrolledInterns?.length > 0 && (
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '1rem', color: '#000' }}>
                  Enrolled Interns ({data.totalEnrolled})
                </h3>
                <div style={{ overflowX: 'auto', border: '2px solid #000', boxShadow: '3px 3px 0 #000' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: '#000', color: '#fff' }}>
                        <th style={th}>Name</th>
                        <th style={th}>Email</th>
                        <th style={th}>Domain</th>
                        <th style={th}>College</th>
                        <th style={th}>Status</th>
                        <th style={th}>Intern ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.enrolledInterns.map((e, i) => (
                        <tr key={e.id} style={{ borderBottom: '1px solid #e0e0e0', background: i % 2 === 0 ? '#fafafa' : '#fff' }}>
                          <td style={td}><strong>{e.name}</strong></td>
                          <td style={td}>{e.email}</td>
                          <td style={td}>{e.domain}</td>
                          <td style={td}>{e.college || '-'}</td>
                          <td style={td}>
                            <span style={{
                              padding: '0.15rem 0.5rem', fontSize: '0.72rem', fontWeight: 800,
                              background: e.status === 'Completed' && e.paymentStatus === 'paid' ? '#34A853' : e.status === 'Completed' ? '#1B7A3D' : e.status === 'Archived' ? '#555' : '#FBBC05',
                              color: '#fff', textTransform: 'uppercase',
                            }}>
                              {e.status === 'Completed' && e.paymentStatus === 'paid' ? 'Completed' : e.status}
                            </span>
                            {e.paymentStatus === 'paid' && (
                              <span style={{
                                padding: '0.15rem 0.5rem', fontSize: '0.65rem', fontWeight: 800,
                                background: '#fff', color: '#34A853',
                                border: '2px solid #34A853', textTransform: 'uppercase',
                                marginLeft: '0.25rem',
                              }}>Paid</span>
                            )}
                          </td>
                          <td style={td}><code style={{ fontSize: '0.78rem' }}>{e.internId || e.id?.slice(0, 8)}</code></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Recent Visits Table */}
            {data.visits?.length > 0 && (
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '1rem', color: '#000' }}>
                  Recent Link Visits ({data.totalVisits})
                </h3>
                <div style={{ overflowX: 'auto', border: '2px solid #000', boxShadow: '3px 3px 0 #000' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ background: '#000', color: '#fff' }}>
                        <th style={th}>Date</th>
                        <th style={th}>Device</th>
                        <th style={th}>Country</th>
                        <th style={th}>City</th>
                        <th style={th}>Browser</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.visits.slice(0, 20).map((v, i) => (
                        <tr key={v.id || i} style={{ borderBottom: '1px solid #e0e0e0', background: i % 2 === 0 ? '#fafafa' : '#fff' }}>
                          <td style={td}>{new Date(v.visitedAt).toLocaleString()}</td>
                          <td style={td}>{v.device || v.os || '-'}</td>
                          <td style={td}>{v.country || '-'}</td>
                          <td style={td}>{v.city || '-'}</td>
                          <td style={td}>{v.browser ? v.browser.slice(0, 40) : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Empty State */}
            {(!data.enrolledInterns || data.enrolledInterns.length === 0) && (!data.visits || data.visits.length === 0) && (
              <div style={{ border: '2px dashed #ccc', padding: '3rem', textAlign: 'center', color: '#aaa', fontSize: '0.95rem' }}>
                No activity yet. Share your referral link to get started!
              </div>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function StatBox({ label, value, color = '#000' }) {
  return (
    <div style={{ border: '2px solid #000', padding: '1.25rem 1.5rem', background: '#fff', boxShadow: '3px 3px 0 #000' }}>
      <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700, color: '#888', marginBottom: '0.3rem' }}>{label}</div>
      <div style={{ fontSize: '2rem', fontWeight: 900, color }}>{value}</div>
    </div>
  );
}

const th = { padding: '0.6rem 0.85rem', textAlign: 'left', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' };
const td = { padding: '0.6rem 0.85rem', verticalAlign: 'top', fontSize: '0.82rem' };
