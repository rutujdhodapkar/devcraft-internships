import React, { useEffect, useState, useRef } from 'react';
import {
  fetchUserEnrollments,
  fetchTemplates,
  submitProject,
  fetchEnrollmentById,
  fetchCareerPaths,
  submitTransactionId,
  isReferralCodeMatched,
  PAYMENT_QR_DEFAULT,
  PAYMENT_QR_REFERRAL,
} from '../services/data';
import { openCertificatePdf } from '../utils/certificatePdf';

/** Generate the HTML document from template + variables and open print dialog */
function generateAndPrint(templateHtml, variables) {
  let html = templateHtml;
  Object.entries(variables).forEach(([k, v]) => {
    html = html.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v || '');
  });
  const win = window.open('', '_blank');
  if (!win) {
    alert('Please allow pop-ups to download your document.');
    return;
  }
  win.document.write(html);
  win.document.close();
  setTimeout(() => {
    win.print();
  }, 500);
}

export default function StudentDashboard({ user, onExploreClick }) {
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [templates, setTemplates] = useState(null);
  const [careerPaths, setCareerPaths] = useState([]);
  const [selectedEnrollment, setSelectedEnrollment] = useState(null);

  // Submission state: { [enrollmentId_projectIdx]: string }
  const [submissionInputs, setSubmissionInputs] = useState({});
  const [submitting, setSubmitting] = useState({}); // { [key]: bool }
  const [submitSuccess, setSubmitSuccess] = useState({}); // { [key]: bool } — show notice

  // Payment Transaction ID state
  const [txnInputs, setTxnInputs] = useState({});
  const [txnSubmitting, setTxnSubmitting] = useState({});
  const [referralMatchedMap, setReferralMatchedMap] = useState({});

  const handleSubmitTransactionId = async (enrollmentId) => {
    const txnId = (txnInputs[enrollmentId] || '').trim();
    if (!txnId) {
      alert('Please enter your payment Transaction ID before submitting.');
      return;
    }
    setTxnSubmitting(prev => ({ ...prev, [enrollmentId]: true }));
    try {
      await submitTransactionId(enrollmentId, txnId);
      await refreshEnrollment(enrollmentId);
      alert('Transaction ID submitted successfully!');
    } catch (err) {
      alert('Failed to submit Transaction ID: ' + err.message);
    } finally {
      setTxnSubmitting(prev => ({ ...prev, [enrollmentId]: false }));
    }
  };

  useEffect(() => {
    if (user) {
      loadAll();
    }
  }, [user]);

  // Pre-fill submission input with previous text if resubmission is requested
  useEffect(() => {
    if (selectedEnrollment) {
      const projects = getProjectsForEnrollment(selectedEnrollment);
      const submissions = getSubmissions(selectedEnrollment);
      const newInputs = {};
      projects.forEach((_, idx) => {
        const sub = submissions[idx];
        if (sub?.resubmit) {
          newInputs[`${selectedEnrollment.id}_${idx}`] = sub.text || '';
        }
      });
      setSubmissionInputs(prev => ({ ...prev, ...newInputs }));
    }
  }, [selectedEnrollment]);

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [data, tmpl, paths] = await Promise.all([
        fetchUserEnrollments(user.uid),
        fetchTemplates(),
        fetchCareerPaths(),
      ]);
      const activeEnrollments = data.filter(e => e.status !== 'Archived');
      setEnrollments(activeEnrollments);
      setTemplates(tmpl);
      setCareerPaths(paths);

      const matchResults = {};
      await Promise.all(activeEnrollments.map(async (enrollment) => {
        if (enrollment.referralCode) {
          matchResults[enrollment.id] = await isReferralCodeMatched(enrollment.referralCode);
        }
      }));
      setReferralMatchedMap(matchResults);
      
      // Auto-select if only 1 enrollment
      if (activeEnrollments.length === 1) {
        setSelectedEnrollment(activeEnrollments[0]);
      }
    } catch (err) {
      setError('Failed to load your internship data.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  /** Refresh a single enrollment after submission */
  const refreshEnrollment = async (enrollmentId) => {
    try {
      const fresh = await fetchEnrollmentById(enrollmentId);
      if (fresh) {
        setEnrollments(prev => prev.map(e => e.id === enrollmentId ? fresh : e));
        setSelectedEnrollment(fresh);
      }
    } catch (e) {
      console.warn('Refresh failed:', e);
    }
  };

  const getProjectsForEnrollment = (enrollment) => {
    if (enrollment.projects && Array.isArray(enrollment.projects) && enrollment.projects.length > 0) {
      return enrollment.projects;
    }
    // Fallback: look up from career paths
    const path = careerPaths.find(p => p.id === enrollment.domainId || p.title === enrollment.domain);
    return path?.projects || [];
  };

  const getSubmissions = (enrollment) => {
    if (!enrollment.submissions) return {};
    return enrollment.submissions;
  };

  const getCompletionPercent = (enrollment) => {
    const projects = getProjectsForEnrollment(enrollment);
    if (projects.length === 0) return 0;
    const submissions = getSubmissions(enrollment);
    const verifiedCount = projects.filter((_, idx) => submissions[idx]?.verified).length;
    return Math.round((verifiedCount / projects.length) * 100);
  };

  const handleSubmitProject = async (enrollment, projectIdx) => {
    const key = `${enrollment.id}_${projectIdx}`;
    const text = (submissionInputs[key] || '').trim();
    if (!text) {
      alert('Please enter your project link or submission text before submitting.');
      return;
    }
    setSubmitting(prev => ({ ...prev, [key]: true }));
    try {
      await submitProject(enrollment.id, projectIdx, text);
      await refreshEnrollment(enrollment.id);
      setSubmitSuccess(prev => ({ ...prev, [key]: true }));
      setSubmissionInputs(prev => ({ ...prev, [key]: '' }));
      // Clear success notice after 6 seconds
      setTimeout(() => setSubmitSuccess(prev => ({ ...prev, [key]: false })), 6000);
    } catch (err) {
      alert('Submission failed: ' + err.message);
    } finally {
      setSubmitting(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleDownloadOffer = (enrollment) => {
    if (!templates?.offer_letter) {
      alert('Offer letter template not available. Please contact support.');
      return;
    }
    generateAndPrint(templates.offer_letter, {
      name: enrollment.name || user.displayName || 'Student',
      domain: enrollment.domain,
      date: new Date(enrollment.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      id: enrollment.id,
      internId: enrollment.internId || enrollment.id,
    });
  };

  const handleDownloadCertificate = (enrollment) => {
    openCertificatePdf({
      name: enrollment.name || user.displayName || 'Student',
      domain: enrollment.domain,
      date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      id: enrollment.id,
      internId: enrollment.internId || enrollment.id,
    });
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <section style={{ backgroundColor: '#f8f8f8', minHeight: 'calc(100vh - 70px)', padding: '3rem 1rem 5rem' }}>
      <div style={{ maxWidth: '860px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '2.5rem' }}>
          <span style={{
            display: 'inline-block',
            backgroundColor: '#000',
            color: '#fff',
            fontSize: '0.7rem',
            fontWeight: 900,
            letterSpacing: '2px',
            padding: '0.3rem 0.75rem',
            marginBottom: '0.75rem',
            textTransform: 'uppercase',
          }}>INTERN DASHBOARD</span>
          <h2 style={{ fontSize: '2rem', fontWeight: 900, textTransform: 'uppercase', margin: '0 0 0.5rem' }}>
            Welcome, {user.displayName?.split(' ')[0] || 'Intern'} 👋
          </h2>
          <p style={{ color: '#666', fontSize: '0.93rem' }}>
            Manage your active internships, submit your projects, and download your credentials.
          </p>
        </div>

        {error && (
          <div style={{ border: '2px solid #EA4335', padding: '1rem', backgroundColor: '#FFF5F5', color: '#EA4335', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '2rem' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#888', fontSize: '1.1rem' }}>
            Loading your internship data…
          </div>
        ) : enrollments.length === 0 ? (
          <div style={{ background: '#fff', border: '2px solid #000', padding: '3rem', textAlign: 'center', boxShadow: '4px 4px 0 #000' }}>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '1rem' }}>No Active Internships</h3>
            <p style={{ color: '#666', fontSize: '0.95rem', maxWidth: '500px', margin: '0 auto 2rem', lineHeight: '1.6' }}>
              You haven\'t enrolled in any internship domains yet. Explore our career paths to get started.
            </p>
            <button
              className="btn-sharp"
              onClick={onExploreClick}
              style={{ padding: '0.6rem 1.5rem', fontSize: '0.88rem', borderRadius: 0 }}
            >
              Explore Programs
            </button>
          </div>
        ) : (
          <div>
            {enrollments.length > 1 && !selectedEnrollment ? (
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '1.5rem', color: '#000' }}>
                  Select an Internship Dashboard
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                  {enrollments.map(e => {
                    const pct = getCompletionPercent(e);
                    const isCompleted = e.status === 'Completed';
                    return (
                      <div key={e.id} style={{ background: '#fff', border: '2px solid #000', padding: '1.5rem', boxShadow: '4px 4px 0 #000', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                          <span style={{
                            backgroundColor: isCompleted ? '#34A853' : '#FBBC05',
                            color: '#fff',
                            fontSize: '0.62rem',
                            fontWeight: 900,
                            letterSpacing: '1px',
                            padding: '0.15rem 0.4rem',
                            textTransform: 'uppercase',
                          }}>
                            {e.status}
                          </span>
                          <h4 style={{ fontSize: '1.2rem', fontWeight: 900, textTransform: 'uppercase', marginTop: '0.5rem', marginBottom: '0.25rem', color: '#000' }}>
                            {e.domain}
                          </h4>
                          <div style={{ fontSize: '0.72rem', color: '#777' }}>Intern ID: {e.internId || e.id}</div>
                        </div>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.25rem', color: '#333' }}>
                            <span>Progress</span>
                            <span>{pct}%</span>
                          </div>
                          <div style={{ height: '6px', background: '#e0e0e0', borderRadius: 0, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#34A853' : '#FBBC05', borderRadius: 0 }} />
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn-sharp"
                          onClick={() => setSelectedEnrollment(e)}
                          style={{ padding: '0.5rem', width: '100%', borderRadius: 0, marginTop: 'auto', fontSize: '0.85rem' }}
                        >
                          Open Dashboard
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              (() => {
                const enrollment = selectedEnrollment || enrollments[0];
                const projects = getProjectsForEnrollment(enrollment);
                const submissions = getSubmissions(enrollment);
                const completionPct = getCompletionPercent(enrollment);
                const allVerified = projects.length > 0 && projects.every((_, idx) => submissions[idx]?.verified);
                const isCompleted = enrollment.status === 'Completed';

                return (
                  <EnrollmentCard
                    enrollment={enrollment}
                    projects={projects}
                    submissions={submissions}
                    completionPct={completionPct}
                    allVerified={allVerified}
                    isCompleted={isCompleted}
                    submissionInputs={submissionInputs}
                    setSubmissionInputs={setSubmissionInputs}
                    submitting={submitting}
                    submitSuccess={submitSuccess}
                    onSubmitProject={handleSubmitProject}
                    onDownloadOffer={handleDownloadOffer}
                    onDownloadCertificate={handleDownloadCertificate}
                    txnInput={txnInputs[enrollment.id] || ''}
                    onTxnInputChange={(val) => setTxnInputs(prev => ({ ...prev, [enrollment.id]: val }))}
                    txnSubmitting={txnSubmitting[enrollment.id] || false}
                    onSubmitTxn={() => handleSubmitTransactionId(enrollment.id)}
                    hasMatchedReferral={!!referralMatchedMap[enrollment.id]}
                    showBackButton={enrollments.length > 1}
                    onBackClick={() => setSelectedEnrollment(null)}
                  />
                );
              })()
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function EnrollmentCard({
  enrollment,
  projects,
  submissions,
  completionPct,
  allVerified,
  isCompleted,
  submissionInputs,
  setSubmissionInputs,
  submitting,
  submitSuccess,
  onSubmitProject,
  onDownloadOffer,
  onDownloadCertificate,
  txnInput,
  onTxnInputChange,
  txnSubmitting,
  onSubmitTxn,
  hasMatchedReferral,
  showBackButton,
  onBackClick,
}) {
  const verifiedCount = projects.filter((_, idx) => submissions[idx]?.verified).length;
  const submittedCount = projects.filter((_, idx) => submissions[idx]?.submittedAt).length;
  const paymentQrUrl = hasMatchedReferral ? PAYMENT_QR_REFERRAL : PAYMENT_QR_DEFAULT;

  return (
    <div>
      {showBackButton && (
        <button
          onClick={onBackClick}
          className="btn-sharp"
          style={{
            marginBottom: '1.5rem',
            padding: '0.6rem 1.25rem',
            background: '#fff',
            color: '#000',
            border: '2px solid #000',
            fontWeight: 800,
            cursor: 'pointer',
            borderRadius: 0,
            fontSize: '0.85rem',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}
        >
          ← Back to Internships
        </button>
      )}
      <div style={{ background: '#fff', border: '2px solid #000', boxShadow: '6px 6px 0 #000', overflow: 'hidden' }}>
      {/* Card Header */}
      <div style={{ borderBottom: '2px solid #000', padding: '1.75rem 2rem', background: isCompleted ? '#000' : '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              <span style={{
                backgroundColor: isCompleted ? '#34A853' : '#FBBC05',
                color: '#fff',
                fontSize: '0.68rem',
                fontWeight: 900,
                letterSpacing: '1.5px',
                padding: '0.2rem 0.6rem',
                textTransform: 'uppercase',
              }}>
                {isCompleted ? '✓ COMPLETED' : '● ACTIVE'}
              </span>
              <span style={{
                backgroundColor: isCompleted ? 'rgba(255,255,255,0.15)' : '#000',
                color: '#fff',
                fontSize: '0.68rem',
                fontWeight: 700,
                letterSpacing: '1px',
                padding: '0.2rem 0.6rem',
              }}>
                {enrollment.duration}
              </span>
            </div>
            <h3 style={{ fontSize: '1.6rem', fontWeight: 900, textTransform: 'uppercase', margin: 0, color: isCompleted ? '#fff' : '#000' }}>
              {enrollment.domain}
            </h3>
          </div>

          {/* Intern ID & Referral */}
          <div style={{ textAlign: 'right' }}>
            {enrollment.referralCode && (
              <div style={{ marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: isCompleted ? 'rgba(255,255,255,0.6)' : '#888', marginBottom: '0.25rem' }}>
                  Referral ID
                </div>
                <code style={{
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  letterSpacing: '1px',
                  color: isCompleted ? '#7affb0' : '#000',
                  background: isCompleted ? 'rgba(255,255,255,0.1)' : '#f0f0f0',
                  padding: '0.25rem 0.5rem',
                  border: isCompleted ? '1px solid rgba(255,255,255,0.2)' : '1px solid #ccc',
                }}>
                  {enrollment.referralCode}
                </code>
              </div>
            )}
            <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: isCompleted ? 'rgba(255,255,255,0.6)' : '#888', marginBottom: '0.25rem' }}>
              Intern ID
            </div>
            <code style={{
              fontSize: '0.95rem',
              fontWeight: 800,
              letterSpacing: '1px',
              color: isCompleted ? '#7affb0' : '#000',
              background: isCompleted ? 'rgba(255,255,255,0.1)' : '#f0f0f0',
              padding: '0.3rem 0.6rem',
              border: isCompleted ? '1px solid rgba(255,255,255,0.2)' : '1px solid #ccc',
            }}>
              {enrollment.internId || enrollment.id}
            </code>
            <div style={{ fontSize: '0.72rem', color: isCompleted ? 'rgba(255,255,255,0.5)' : '#aaa', marginTop: '0.3rem' }}>
              Enrolled: {new Date(enrollment.createdAt).toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Progress Bar with NO rounded corners */}
        <div style={{ marginTop: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.4rem', color: isCompleted ? 'rgba(255,255,255,0.7)' : '#555' }}>
            <span>Completion Progress</span>
            <span>{completionPct}% ({verifiedCount}/{projects.length} verified)</span>
          </div>
          <div style={{ height: '8px', background: isCompleted ? 'rgba(255,255,255,0.2)' : '#e0e0e0', borderRadius: 0, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${completionPct}%`,
              background: completionPct === 100 ? '#34A853' : 'linear-gradient(90deg, #FBBC05, #f5a700)',
              borderRadius: 0,
              transition: 'width 0.5s ease',
            }} />
          </div>
        </div>
      </div>

      {/* Projects Section */}
      <div style={{ padding: '1.75rem 2rem' }}>
        <h4 style={{ fontSize: '1rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1.25rem', color: '#000' }}>
          📋 Project Submissions
        </h4>

        {projects.length === 0 ? (
          <p style={{ color: '#888', fontSize: '0.88rem' }}>No projects defined for this domain yet. Check back soon.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {projects.map((project, idx) => {
              const sub = submissions[idx];
              const key = `${enrollment.id}_${idx}`;
              const isSubmitted = !!sub?.submittedAt;
              const isVerified = !!sub?.verified;
              const isSubmittingNow = submitting[key];
              const showSuccessMsg = submitSuccess[key];

              const title = typeof project === 'object' && project !== null ? (project.title || project.name || '') : project;
              const description = typeof project === 'object' && project !== null ? project.description : '';
              const links = typeof project === 'object' && project !== null ? project.links : '';

              return (
                <ProjectBox
                  key={idx}
                  idx={idx}
                  projectName={title}
                  description={description}
                  links={links}
                  isSubmitted={isSubmitted}
                  isVerified={isVerified}
                  sub={sub}
                  inputKey={key}
                  inputValue={submissionInputs[key] || ''}
                  onInputChange={(val) => setSubmissionInputs(prev => ({ ...prev, [key]: val }))}
                  onSubmit={() => onSubmitProject(enrollment, idx)}
                  isSubmittingNow={isSubmittingNow}
                  showSuccessMsg={showSuccessMsg}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Certificates Section */}
      <div style={{ padding: '1.25rem 2rem 1.75rem', borderTop: '2px solid #e8e8e8', background: '#fafafa' }}>
        <h4 style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1rem', color: '#555' }}>
          Your Documents
        </h4>
        
        <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {/* Offer Letter — always available */}
            <button
              className="btn-sharp"
              onClick={() => onDownloadOffer(enrollment)}
              style={{ padding: '0.6rem 1.5rem', fontSize: '0.85rem', borderRadius: 0 }}
            >
              ⬇ Download Offer Letter
            </button>

            {/* Certificate Button — unlocks only if allowedCertificate is 'yes' */}
            {enrollment.allowedCertificate === 'yes' ? (
              <button
                className="btn-sharp"
                onClick={() => onDownloadCertificate(enrollment)}
                style={{ padding: '0.6rem 1.5rem', fontSize: '0.85rem', backgroundColor: '#34A853', color: '#fff', border: '2px solid #34A853', borderRadius: 0 }}
              >
                🏆 Download Certificate
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  disabled
                  style={{
                    padding: '0.6rem 1.5rem',
                    fontSize: '0.85rem',
                    border: '2px solid #ccc',
                    background: '#f5f5f5',
                    color: '#999',
                    cursor: 'not-allowed',
                    fontWeight: 700,
                    borderRadius: 0,
                  }}
                >
                  🔒 Certificate Locked
                </button>
                <span style={{ fontSize: '0.75rem', color: '#888' }}>
                  Unlocked after payment & admin approval
                </span>
              </div>
            )}
          </div>

          {/* Conditional Payment QR & Transaction ID entry section */}
          {enrollment.allowedCertificate !== 'yes' && (
            <div>
              {submittedCount === projects.length ? (
                <div style={{ border: '2px solid #000', padding: '1.5rem', background: '#fff', marginTop: '1rem' }}>
                  <h5 style={{ fontSize: '0.95rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                    Unlock Completion Certificate
                  </h5>
                  
                  {enrollment.transactionId ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ fontSize: '0.85rem', color: '#333' }}>
                        <strong>Transaction ID Submitted:</strong> <code>{enrollment.transactionId}</code>
                      </div>
                      <div style={{
                        padding: '0.75rem 1rem',
                        background: '#fffbea',
                        borderLeft: '4px solid #FBBC05',
                        fontSize: '0.82rem',
                        color: '#7a6000',
                      }}>
                        ⏳ <strong>Pending Admin Review:</strong> Our team is verifying your payment. Once approved, your certificate download will be enabled here instantly.
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p style={{ fontSize: '0.85rem', color: '#555', marginBottom: '1rem', lineHeight: '1.5' }}>
                        To download your official Internship Completion Certificate, please scan the QR code below using Google Pay to complete the verification payment, then enter the payment Transaction ID to submit for approval.
                      </p>
                      <div style={{ marginBottom: '1.25rem' }}>
                        <img
                          src={paymentQrUrl}
                          alt="Google Pay QR Code"
                          style={{ width: '220px', border: '2px solid #000', display: 'block' }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end', maxWidth: '450px' }}>
                        <div style={{ flex: 1, minWidth: '200px' }}>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem', color: '#333' }}>
                            Transaction ID *
                          </label>
                          <input
                            type="text"
                            placeholder="Enter 12-digit UPI / Transaction ID"
                            value={txnInput}
                            onChange={(e) => onTxnInputChange(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '0.55rem 0.75rem',
                              border: '2px solid #000',
                              fontSize: '0.88rem',
                              outline: 'none',
                              fontFamily: 'inherit',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>
                        <button
                          onClick={onSubmitTxn}
                          disabled={txnSubmitting || !txnInput.trim()}
                          className="btn-sharp"
                          style={{
                            padding: '0.55rem 1.25rem',
                            fontSize: '0.85rem',
                            height: '37px',
                            opacity: !txnInput.trim() ? 0.5 : 1,
                            borderRadius: 0,
                          }}
                        >
                          {txnSubmitting ? 'Submitting…' : 'Submit ID'}
                        </button>
                      </div>
                      <p style={{ fontSize: '0.72rem', color: '#777', marginTop: '0.5rem' }}>
                        * Required to unlock download certificate. You cannot move forward without entering this.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{
                  marginTop: '1rem',
                  padding: '0.75rem 1rem',
                  background: '#f5f5f5',
                  borderLeft: '4px solid #ccc',
                  fontSize: '0.82rem',
                  color: '#666',
                }}>
                  Please complete and submit all <strong>{projects.length}</strong> projects to unlock the payment QR and certificate download.
                </div>
              )}
            </div>
          )}
        </div>

        {!isCompleted && submittedCount > 0 && (
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem 1rem',
            background: '#fffbea',
            border: '1px solid #f0d060',
            borderLeft: '4px solid #FBBC05',
            fontSize: '0.82rem',
            color: '#7a6000',
            lineHeight: '1.5',
          }}>
            <strong>⏳ Pending Review:</strong> Our team will review your submitted project(s) and verify them shortly. Once all projects are verified, your Completion Certificate will be unlocked.
          </div>
        )}
      </div>
    </div>
  </div>
);
}

function ProjectBox({
  idx,
  projectName,
  description,
  links,
  isSubmitted,
  isVerified,
  sub,
  inputKey,
  inputValue,
  onInputChange,
  onSubmit,
  isSubmittingNow,
  showSuccessMsg,
}) {
  return (
    <div style={{
      border: isVerified
        ? '2px solid #34A853'
        : isSubmitted
        ? '2px solid #FBBC05'
        : '2px solid #ddd',
      padding: '1.25rem',
      background: isVerified ? '#f0fdf4' : isSubmitted ? '#fffdf0' : '#fff',
      position: 'relative',
      transition: 'border-color 0.2s',
      borderRadius: 0,
    }}>
      {/* Project Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{
            width: '26px',
            height: '26px',
            borderRadius: '50%',
            background: isVerified ? '#34A853' : isSubmitted ? '#FBBC05' : '#000',
            color: '#fff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.75rem',
            fontWeight: 900,
            flexShrink: 0,
          }}>
            {isVerified ? '✓' : idx + 1}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <strong style={{ fontSize: '0.95rem', fontWeight: 800, color: '#000' }}>
              Project {idx + 1}: {projectName}
            </strong>
            {description && (
              <p style={{ fontSize: '0.88rem', color: '#555', margin: '0.35rem 0 0.5rem 0', lineHeight: '1.5' }}>
                {description}
              </p>
            )}
            {links && (
              <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.2rem' }}>
                <strong>Reference Resources:</strong>{' '}
                {links.split(',').map((link, lIdx) => {
                  const trimmedLink = link.trim();
                  if (!trimmedLink) return null;
                  const href = trimmedLink.startsWith('http') ? trimmedLink : `https://${trimmedLink}`;
                  return (
                    <a
                      key={lIdx}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#000', textDecoration: 'underline', marginRight: '0.75rem', fontWeight: 700 }}
                    >
                      Resource {lIdx + 1}
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Status Badge */}
        {isVerified && (
          <span style={{
            background: '#34A853',
            color: '#fff',
            fontSize: '0.68rem',
            fontWeight: 900,
            letterSpacing: '1px',
            padding: '0.2rem 0.6rem',
            textTransform: 'uppercase',
          }}>✓ VERIFIED</span>
        )}
        {!isVerified && isSubmitted && (
          <span style={{
            background: '#FBBC05',
            color: '#5a4000',
            fontSize: '0.68rem',
            fontWeight: 900,
            letterSpacing: '1px',
            padding: '0.2rem 0.6rem',
            textTransform: 'uppercase',
          }}>⏳ SUBMITTED</span>
        )}
        {!isVerified && !isSubmitted && (
          <span style={{
            background: '#eee',
            color: '#666',
            fontSize: '0.68rem',
            fontWeight: 700,
            letterSpacing: '1px',
            padding: '0.2rem 0.6rem',
            textTransform: 'uppercase',
          }}>PENDING</span>
        )}
      </div>

      {/* Submitted view (read-only) */}
      {isSubmitted ? (
        <div>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: '#888', marginBottom: '0.35rem' }}>
            Your Submission
          </div>
          <div style={{
            padding: '0.75rem 1rem',
            background: '#f5f5f5',
            border: '1px solid #ddd',
            fontSize: '0.88rem',
            color: '#333',
            wordBreak: 'break-all',
            lineHeight: '1.5',
            fontFamily: sub?.text?.startsWith('http') ? 'monospace' : 'inherit',
          }}>
            {sub.text}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#aaa', marginTop: '0.4rem' }}>
            Submitted: {new Date(sub.submittedAt).toLocaleString()}
            {sub.verified && sub.verifiedAt && (
              <span style={{ color: '#34A853', marginLeft: '1rem' }}>
                ✓ Verified: {new Date(sub.verifiedAt).toLocaleString()}
              </span>
            )}
          </div>
          {!isVerified && (
            <div style={{
              marginTop: '0.75rem',
              padding: '0.6rem 0.85rem',
              background: '#fffbea',
              border: '1px solid #f0d060',
              fontSize: '0.78rem',
              color: '#7a6000',
            }}>
              📬 Our team will review and verify your submission shortly.
            </div>
          )}
        </div>
      ) : (
        /* Submit form */
        <div>
          {!isVerified && !isSubmitted && sub?.resubmit && (
            <div style={{
              marginBottom: '1rem',
              padding: '0.75rem 1.25rem',
              backgroundColor: '#fff5f5',
              border: '2px solid #ea4335',
              borderLeft: '6px solid #ea4335',
              color: '#ea4335',
              fontSize: '0.85rem',
              lineHeight: '1.5',
            }}>
              <strong style={{ textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>⚠️ Revision Requested by Admin</strong>
              {sub.feedback || 'Please update your submission and submit again.'}
            </div>
          )}
          <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: '#666', marginBottom: '0.5rem' }}>
            Submit your project link or paste your work below:
          </div>
          <textarea
            rows={3}
            placeholder={`Paste your GitHub link, live demo URL, or describe your project submission for "${projectName}"…`}
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            style={{
              width: '100%',
              padding: '0.65rem 0.85rem',
              border: '2px solid #ccc',
              fontSize: '0.88rem',
              resize: 'vertical',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
              outline: 'none',
              lineHeight: '1.5',
            }}
            onFocus={(e) => e.target.style.borderColor = '#000'}
            onBlur={(e) => e.target.style.borderColor = '#ccc'}
          />
          <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              onClick={onSubmit}
              disabled={isSubmittingNow || !inputValue.trim()}
              className="btn-sharp"
              style={{
                padding: '0.5rem 1.5rem',
                fontSize: '0.85rem',
                opacity: (!inputValue.trim()) ? 0.5 : 1,
              }}
            >
              {isSubmittingNow ? 'Submitting…' : 'Submit Project'}
            </button>
            {showSuccessMsg && (
              <span style={{ fontSize: '0.82rem', color: '#34A853', fontWeight: 700 }}>
                ✓ Submitted successfully! Our team will verify it shortly.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
