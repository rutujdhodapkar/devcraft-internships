import React, { useEffect, useState } from 'react';
import { fetchReferralDashboardData, fetchSelfReferralCode, fetchSiteNotices } from '../services/data';

export default function ReferralDashboard({ user, onBackClick }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [code, setCode] = useState(null);
  const [siteNotices, setSiteNotices] = useState([]);

  const loadDashboard = async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const userCode = await fetchSelfReferralCode(user.uid);
      if (!userCode) {
        setError('You do not have a referral code yet. Go to the Earn section to create one.');
        setLoading(false);
        return;
      }
      setCode(userCode);
      const dashboardData = await fetchReferralDashboardData(user.uid);
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
    alert('Referral link copied!');
  };

  return (
    <section style={{ backgroundColor: '#f8f8f8', minHeight: 'calc(100vh - 70px)', padding: '8.5rem 1rem 5rem' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
          <div>
            <span style={{ display: 'inline-block', backgroundColor: '#000', color: '#fff', fontSize: '0.7rem', fontWeight: 900, letterSpacing: '2px', padding: '0.3rem 0.75rem', marginBottom: '0.75rem', textTransform: 'uppercase' }}>
              REFERRAL DASHBOARD
            </span>
            <h2 style={{ fontSize: '2rem', fontWeight: 900, textTransform: 'uppercase', margin: '0 0 0.25rem' }}>
              Your Referral Hub
            </h2>
            <p style={{ color: '#666', fontSize: '0.93rem', margin: 0 }}>
              Track your referral performance and earnings.
            </p>
          </div>
          <button className="btn-sharp-outline" onClick={onBackClick} style={{ padding: '0.6rem 1.25rem', fontSize: '0.85rem', fontWeight: 700 }}>
            ← Back
          </button>
        </div>

        {error && (
          <div style={{ border: '2px solid #EA4335', padding: '1.5rem', backgroundColor: '#FFF5F5', color: '#EA4335', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '2rem', textAlign: 'center' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#888', fontSize: '1.1rem' }}>
            Loading your referral dashboard...
          </div>
        ) : data && (
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

            {/* Stats */}
            <div style={{ border: '2px solid #000', background: '#EBFCEF', padding: '1rem 1.25rem', marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '0.85rem', lineHeight: 1.6, color: '#333' }}>
                Earn <strong>₹20</strong> for each referred intern who completes their internship, plus a <strong>₹1,000</strong> bonus at 50 completions.
                {' '}<a href="/#referral-rewards" style={{ color: '#000', fontWeight: 800 }}>See how you can earn ₹2,000 per 50 completed interns →</a>
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, marginTop: '0.5rem', color: '#34A853' }}>
                Estimated earnings: ₹{(data.completedInterns || 0) * 20 + Math.floor((data.completedInterns || 0) / 50) * 1000}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
              <StatBox label="Link Visits" value={data.totalVisits} />
              <StatBox label="Total Logins" value={data.totalLogins} />
              <StatBox label="Enrolled Interns" value={data.totalEnrolled} color="#FBBC05" />
              <StatBox label="Completed" value={data.completedInterns} color="#34A853" />
            </div>

            {/* Enrolled Interns */}
            {data.enrolledInterns.length > 0 && (
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
                          <td style={td}><code style={{ fontSize: '0.78rem' }}>{e.internId || e.id.slice(0, 8)}</code></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Recent Visits */}
            {data.visits.length > 0 && (
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

            {data.enrolledInterns.length === 0 && data.visits.length === 0 && (
              <div style={{ border: '2px dashed #ccc', padding: '3rem', textAlign: 'center', color: '#aaa', fontSize: '0.95rem' }}>
                No activity yet. Share your referral link to get started!
              </div>
            )}
          </div>
        )}
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
