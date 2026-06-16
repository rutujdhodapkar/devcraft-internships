import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import CareerPaths from './components/CareerPaths';
import HowItWorks from './components/HowItWorks';
import FAQ from './components/FAQ';
import AuthPage from './components/AuthPage';
import StudentDashboard from './components/StudentDashboard';
import Footer from './components/Footer';
import AdminPanel from './components/AdminPanel';
import EarnSection from './components/EarnSection';
import ReferralDashboard from './components/ReferralDashboard';
import IDCardModal from './components/IDCardModal';
import {
  processReferralFromUrl,
  checkAdminStatus,
  fetchUserProfile,
  saveUserProfile,
  enrollStudent,
  fetchUserEnrollments,
  recordReferralLogin,
  isReferralCodeMatched,
  savePermanentReferralCode,
  fetchSelfReferralCode
} from './services/data';
import { auth, googleProvider, isFirebaseConfigured } from './firebase';
import { onAuthStateChanged, signOut, signInWithPopup } from 'firebase/auth';

async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Country codes list (top 60+ countries)
const COUNTRY_CODES = [
  { code: '+91', country: 'India', iso: 'IN' },
  { code: '+1', country: 'United States', iso: 'US' },
  { code: '+44', country: 'United Kingdom', iso: 'GB' },
  { code: '+61', country: 'Australia', iso: 'AU' },
  { code: '+1', country: 'Canada', iso: 'CA' },
  { code: '+49', country: 'Germany', iso: 'DE' },
  { code: '+33', country: 'France', iso: 'FR' },
  { code: '+39', country: 'Italy', iso: 'IT' },
  { code: '+34', country: 'Spain', iso: 'ES' },
  { code: '+31', country: 'Netherlands', iso: 'NL' },
  { code: '+46', country: 'Sweden', iso: 'SE' },
  { code: '+47', country: 'Norway', iso: 'NO' },
  { code: '+45', country: 'Denmark', iso: 'DK' },
  { code: '+358', country: 'Finland', iso: 'FI' },
  { code: '+41', country: 'Switzerland', iso: 'CH' },
  { code: '+43', country: 'Austria', iso: 'AT' },
  { code: '+32', country: 'Belgium', iso: 'BE' },
  { code: '+351', country: 'Portugal', iso: 'PT' },
  { code: '+48', country: 'Poland', iso: 'PL' },
  { code: '+7', country: 'Russia', iso: 'RU' },
  { code: '+380', country: 'Ukraine', iso: 'UA' },
  { code: '+90', country: 'Turkey', iso: 'TR' },
  { code: '+966', country: 'Saudi Arabia', iso: 'SA' },
  { code: '+971', country: 'UAE', iso: 'AE' },
  { code: '+20', country: 'Egypt', iso: 'EG' },
  { code: '+27', country: 'South Africa', iso: 'ZA' },
  { code: '+234', country: 'Nigeria', iso: 'NG' },
  { code: '+254', country: 'Kenya', iso: 'KE' },
  { code: '+233', country: 'Ghana', iso: 'GH' },
  { code: '+92', country: 'Pakistan', iso: 'PK' },
  { code: '+880', country: 'Bangladesh', iso: 'BD' },
  { code: '+94', country: 'Sri Lanka', iso: 'LK' },
  { code: '+977', country: 'Nepal', iso: 'NP' },
  { code: '+86', country: 'China', iso: 'CN' },
  { code: '+81', country: 'Japan', iso: 'JP' },
  { code: '+82', country: 'South Korea', iso: 'KR' },
  { code: '+65', country: 'Singapore', iso: 'SG' },
  { code: '+60', country: 'Malaysia', iso: 'MY' },
  { code: '+66', country: 'Thailand', iso: 'TH' },
  { code: '+62', country: 'Indonesia', iso: 'ID' },
  { code: '+63', country: 'Philippines', iso: 'PH' },
  { code: '+84', country: 'Vietnam', iso: 'VN' },
  { code: '+55', country: 'Brazil', iso: 'BR' },
  { code: '+54', country: 'Argentina', iso: 'AR' },
  { code: '+57', country: 'Colombia', iso: 'CO' },
  { code: '+52', country: 'Mexico', iso: 'MX' },
  { code: '+56', country: 'Chile', iso: 'CL' },
  { code: '+51', country: 'Peru', iso: 'PE' },
  { code: '+593', country: 'Ecuador', iso: 'EC' },
  { code: '+64', country: 'New Zealand', iso: 'NZ' },
];

const COUNTRY_NAMES = COUNTRY_CODES.map(c => c.country).sort();

/** Auto-detect country code from browser locale */
function detectCountryCode() {
  const lang = navigator.language || navigator.userLanguage || '';
  const region = lang.includes('-') ? lang.split('-')[1].toUpperCase() : '';
  const match = COUNTRY_CODES.find(c => c.iso === region);
  return match ? match.code : '+91';
}

export default function App() {
  const [currentView, setCurrentView] = useState('site'); // 'site', 'auth', 'dashboard', 'admin'
  const [referralCode, setReferralCode] = useState('');

  // Routing Redirection Target
  const [authRedirectTarget, setAuthRedirectTarget] = useState('site');

  // Auth States
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [hasReferralCode, setHasReferralCode] = useState(false);

  // Profile Prompt States
  const [showProfilePrompt, setShowProfilePrompt] = useState(false);
  const [profileForm, setProfileForm] = useState({
    countryCode: detectCountryCode(),
    phone: '',
    college: '',
    city: '',
    country: '',
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileErrors, setProfileErrors] = useState({});
  const [referralCodeInput, setReferralCodeInput] = useState('');
  const [referralCheckStatus, setReferralCheckStatus] = useState('idle'); // 'idle' | 'checking' | 'matched' | 'not_matched'

  // Internship Enrollment Pipeline
  const [pendingEnrollmentDomain, setPendingEnrollmentDomain] = useState(null);

  // ID Card Modal
  const [showIdCard, setShowIdCard] = useState(false);
  const [idCardEnrollment, setIdCardEnrollment] = useState(null);
  const [idCardLoading, setIdCardLoading] = useState(false);

  // Listen to Firebase Auth state
  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setAuthLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser && currentUser.email) {
        // Always re-read URL on auth change so referral is checked at login
        const { code: urlCode, matched } = await processReferralFromUrl();
        const storedReferral = matched ? urlCode : '';
        if (storedReferral) {
          setReferralCode(storedReferral);
          // Save referral permanently to user's profile
          savePermanentReferralCode(currentUser.uid, storedReferral).catch(() => {});
        }
        if (storedReferral) {
          recordReferralLogin(storedReferral, currentUser).catch((e) => {
            console.warn('Could not record referral login:', e.message);
          });
        }

        // Check if user has a self-created referral code
        fetchSelfReferralCode(currentUser.uid).then(code => {
          setHasReferralCode(!!code);
        }).catch(() => setHasReferralCode(false));

        // Check root admin hash
        const hash = await sha256(currentUser.email.toLowerCase());
        const isRootAdmin = hash === '9de7c6f74278613debd72673db80f6d8d69bb7c0aae71746745d75fc5e264083';
        let isUserAdmin = isRootAdmin;

        if (!isUserAdmin) {
          try {
            const checkRes = await checkAdminStatus(currentUser.email);
            isUserAdmin = checkRes.isAdmin;
          } catch (e) {
            console.warn('Could not verify admin status:', e.message);
          }
        }
        setIsAdmin(isUserAdmin);

        // Fetch / Sync profile details from RTDB
        try {
          const profile = await fetchUserProfile(currentUser.uid);
          if (profile) {
            setUserProfile(profile);

            // Check if profile is complete — skip prompt if already saved
            const isComplete = profile.phone && profile.college && profile.city && profile.country;
            if (!isComplete) {
              setProfileForm({
                countryCode: profile.countryCode || detectCountryCode(),
                phone: profile.phone || '',
                college: profile.college || '',
                city: profile.city || '',
                country: profile.country || '',
              });
              setShowProfilePrompt(true);
            } else {
              // Profile is complete!
              // If they already have applied internships, direct open their dashboard
              try {
                const userEnrs = await fetchUserEnrollments(currentUser.uid);
                if (currentView !== 'admin' && userEnrs.length > 0) {
                  setCurrentView('dashboard');
                } else if (pendingEnrollmentDomain) {
                  await enrollStudent(currentUser.uid, profile, pendingEnrollmentDomain);
                  setPendingEnrollmentDomain(null);
                  setCurrentView('dashboard');
                } else if (currentView === 'auth') {
                  setCurrentView(isUserAdmin ? 'admin' : authRedirectTarget);
                }
              } catch (e) {
                console.warn('Error fetching user enrollments on auth change:', e);
                if (pendingEnrollmentDomain) {
                  await enrollStudent(currentUser.uid, profile, pendingEnrollmentDomain);
                  setPendingEnrollmentDomain(null);
                  setCurrentView('dashboard');
                } else if (currentView === 'auth') {
                  setCurrentView(isUserAdmin ? 'admin' : authRedirectTarget);
                }
              }
            }
          } else {
            // Profile does not exist yet
            setProfileForm({
              countryCode: detectCountryCode(),
              phone: '',
              college: '',
              city: '',
              country: '',
            });
            setShowProfilePrompt(true);
          }
        } catch (err) {
          console.error('Profile fetch failed:', err);
        }
      } else {
        setIsAdmin(false);
        setUserProfile(null);
        setHasReferralCode(false);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, [currentView, pendingEnrollmentDomain, authRedirectTarget]);

  // Reset referral input when profile prompt opens
  useEffect(() => {
    if (showProfilePrompt) {
      setReferralCodeInput('');
      setReferralCheckStatus('idle');
    }
  }, [showProfilePrompt]);

  // Referral tracking — read ref from URL, count visit if matched, persist code for intern enrollment
  useEffect(() => {
    processReferralFromUrl()
      .then(({ code, matched }) => {
        if (matched && code) {
          setReferralCode(code);
        } else {
          setReferralCode('');
        }
      })
      .catch((error) => {
        console.warn('Referral processing failed:', error.message);
      });
  }, []);

  const handleApplyDomain = async (domainObj) => {
    if (!user) {
      setPendingEnrollmentDomain(domainObj);
      setAuthRedirectTarget('dashboard');
      setCurrentView('auth');
      return;
    }

    // Check if user profile has all details
    if (!userProfile || !userProfile.phone || !userProfile.college || !userProfile.city || !userProfile.country) {
      setPendingEnrollmentDomain(domainObj);
      setShowProfilePrompt(true);
      return;
    }

    try {
      setAuthLoading(true);
      const existingEnrollments = await fetchUserEnrollments(user.uid);
      const alreadyApplied = existingEnrollments.some((e) => (
        e.domainId === domainObj.id ||
        (e.domain || '').toLowerCase() === (domainObj.title || '').toLowerCase()
      ));
      if (alreadyApplied) {
        setCurrentView('dashboard');
        return;
      }
      await enrollStudent(user.uid, userProfile, domainObj);
      setCurrentView('dashboard');
    } catch (err) {
      alert('Enrollment failed: ' + err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const validateProfile = () => {
    const errors = {};
    const phoneDigits = profileForm.phone.replace(/\D/g, '');
    if (!profileForm.phone.trim()) {
      errors.phone = 'Phone number is required.';
    } else if (phoneDigits.length < 7 || phoneDigits.length > 15) {
      errors.phone = 'Enter a valid phone number (7–15 digits).';
    }
    if (!profileForm.college.trim() || profileForm.college.trim().length < 3) {
      errors.college = 'Please enter your college/university name.';
    }
    if (!profileForm.city.trim() || profileForm.city.trim().length < 2) {
      errors.city = 'Please enter a valid city name.';
    }
    if (!profileForm.country) {
      errors.country = 'Please select your country.';
    }
    return errors;
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    const errors = validateProfile();
    if (Object.keys(errors).length > 0) {
      setProfileErrors(errors);
      return;
    }
    setProfileErrors({});
    setProfileSaving(true);

    try {
      const fullPhone = `${profileForm.countryCode}${profileForm.phone.trim()}`;
      const updatedProfile = {
        name: user.displayName || 'Student',
        email: user.email || '',
        photoURL: user.photoURL || '',
        countryCode: profileForm.countryCode,
        phone: fullPhone,
        college: profileForm.college.trim(),
        city: profileForm.city.trim(),
        country: profileForm.country,
      };
      // Store referral code in localStorage if matched (enrollStudent will read & clear it)
      if (referralCheckStatus === 'matched' && referralCodeInput.trim()) {
        localStorage.setItem('detected_referral_code', referralCodeInput.trim().toUpperCase());
      }

      await saveUserProfile(user.uid, updatedProfile);
      setUserProfile(updatedProfile);
      setShowProfilePrompt(false);

      // Execute pending enrollment if exists
      if (pendingEnrollmentDomain) {
        await enrollStudent(user.uid, updatedProfile, pendingEnrollmentDomain);
        setPendingEnrollmentDomain(null);
        setCurrentView('dashboard');
      } else if (currentView === 'auth') {
        setCurrentView(isAdmin ? 'admin' : authRedirectTarget);
      }
    } catch (err) {
      alert('Failed to save profile: ' + err.message);
    } finally {
      setProfileSaving(false);
    }
  };

  const handleLoginClick = async () => {
    if (isFirebaseConfigured && auth && googleProvider) {
      try {
        setAuthLoading(true);
        googleProvider.setCustomParameters({ prompt: 'select_account' });
        await signInWithPopup(auth, googleProvider);
      } catch (err) {
        if (err.code === 'auth/popup-blocked') {
          alert('Popup was blocked by your browser. Please allow popups for this site or try again.');
        } else if (err.code === 'auth/popup-closed-by-user') {
          // User closed popup - not an error
        } else {
          console.error('Google Sign In failed:', err);
        }
      } finally {
        setAuthLoading(false);
      }
    } else {
      setAuthRedirectTarget('site');
      setCurrentView('auth');
    }
  };

  const handleShowIdCard = async () => {
    if (!user) return;
    setIdCardLoading(true);
    try {
      const enrollments = await fetchUserEnrollments(user.uid);
      const activeEnrollment = enrollments.find(e => e.status !== 'Archived') || enrollments[0];
      setIdCardEnrollment(activeEnrollment || null);
      setShowIdCard(true);
    } catch {
      setIdCardEnrollment(null);
      setShowIdCard(true);
    } finally {
      setIdCardLoading(false);
    }
  };

  const handleLogout = async () => {
    if (isFirebaseConfigured && auth) {
      await signOut(auth);
    }
    setUser(null);
    setUserProfile(null);
    setIsAdmin(false);
    setHasReferralCode(false);
    setCurrentView('site');
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'admin':
        return <AdminPanel onClose={() => setCurrentView('site')} user={user} onLogout={handleLogout} />;
      case 'auth':
        return <AuthPage onAuthSuccess={() => {}} onBackToSite={() => setCurrentView('site')} />;
      case 'dashboard':
        return (
          <>
            <Navbar
              onAdminClick={() => setCurrentView('admin')}
              user={user}
              isAdmin={isAdmin}
              onLogout={handleLogout}
              authLoading={authLoading}
              onLoginClick={handleLoginClick}
              onHomeClick={() => setCurrentView('site')}
              onDashboardClick={() => setCurrentView('dashboard')}
              onReferralDashboardClick={() => setCurrentView('referralDashboard')}
              hasReferralCode={hasReferralCode}
              onShowIdCard={handleShowIdCard}
            />
            <StudentDashboard
              user={user}
              onExploreClick={() => {
                setCurrentView('site');
                setTimeout(() => {
                  document.getElementById('domains')?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }}
            />
            <Footer />
          </>
        );
      case 'referralDashboard':
        return (
          <>
            <Navbar
              onAdminClick={() => setCurrentView('admin')}
              user={user}
              isAdmin={isAdmin}
              onLogout={handleLogout}
              authLoading={authLoading}
              onLoginClick={handleLoginClick}
              onHomeClick={() => setCurrentView('site')}
              onDashboardClick={() => setCurrentView('dashboard')}
              onReferralDashboardClick={() => setCurrentView('referralDashboard')}
              hasReferralCode={hasReferralCode}
              onShowIdCard={handleShowIdCard}
            />
            <ReferralDashboard
              user={user}
              onBackClick={() => setCurrentView('site')}
            />
            <Footer />
          </>
        );
      case 'site':
      default:
        return (
          <>
            <Navbar
              onAdminClick={() => setCurrentView('admin')}
              user={user}
              isAdmin={isAdmin}
              onLogout={handleLogout}
              authLoading={authLoading}
              onLoginClick={handleLoginClick}
              onHomeClick={() => setCurrentView('site')}
              onDashboardClick={() => setCurrentView('dashboard')}
              onReferralDashboardClick={() => setCurrentView('referralDashboard')}
              hasReferralCode={hasReferralCode}
              onShowIdCard={handleShowIdCard}
            />
            <Hero
              onApplyClick={() => {
                const el = document.getElementById('domains');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              onExploreClick={() => {
                const el = document.getElementById('domains');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
            />
            <CareerPaths onApplyDomain={handleApplyDomain} />
            <HowItWorks />
            <FAQ />
            <EarnSection user={user} userProfile={userProfile} onLoginClick={handleLoginClick} />
            <Footer />
          </>
        );
    }
  };

  const inputStyle = {
    border: '2px solid #000',
    padding: '0.6rem 0.75rem',
    width: '100%',
    boxSizing: 'border-box',
    fontSize: '0.9rem',
    outline: 'none',
    fontFamily: 'inherit',
  };
  const errorStyle = { color: '#EA4335', fontSize: '0.75rem', marginTop: '0.25rem', fontWeight: 600 };

  return (
    <>
      {renderCurrentView()}

      {/* Collect Student Profile Details Modal */}
      {/* ID Card Modal */}
      {showIdCard && (
        <IDCardModal
          user={user}
          enrollment={idCardEnrollment}
          onClose={() => { setShowIdCard(false); setIdCardEnrollment(null); }}
        />
      )}

      {showProfilePrompt && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100 }}>
          <div className="modal-content card-sharp" style={{ backgroundColor: '#fff', padding: '2.5rem', width: '90%', maxWidth: '500px', border: '3px solid #000', boxShadow: '8px 8px 0 #000', position: 'relative', maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ height: '6px', background: 'linear-gradient(90deg,#000 0%,#444 100%)', position: 'sticky', top: '-2.5rem', marginBottom: '1.5rem', marginLeft: '-2.5rem', marginRight: '-2.5rem', marginTop: '-2.5rem' }} />

            <h3 style={{ fontSize: '1.4rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Complete Your Profile</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.5' }}>
              We need a few details to issue your Offer Letter and set up your internship. This info is saved and won't be asked again.
            </p>

            <form onSubmit={handleProfileSubmit}>

              {/* Phone Number with Country Code */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>Phone Number *</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <select
                    value={profileForm.countryCode}
                    onChange={(e) => setProfileForm({ ...profileForm, countryCode: e.target.value })}
                    style={{ ...inputStyle, width: 'auto', minWidth: '110px', flex: '0 0 auto', cursor: 'pointer', background: '#fff' }}
                  >
                    {COUNTRY_CODES.map((c, i) => (
                      <option key={`${c.iso}-${i}`} value={c.code}>
                        {c.code} {c.iso}
                      </option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    placeholder="9876543210"
                    value={profileForm.phone}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^\d\s\-]/g, '');
                      setProfileForm({ ...profileForm, phone: val });
                    }}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                </div>
                {profileErrors.phone && <div style={errorStyle}>{profileErrors.phone}</div>}
              </div>

              {/* College */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>College / University *</label>
                <input
                  type="text"
                  placeholder="E.g., IIT Bombay"
                  value={profileForm.college}
                  onChange={(e) => setProfileForm({ ...profileForm, college: e.target.value })}
                  style={inputStyle}
                />
                {profileErrors.college && <div style={errorStyle}>{profileErrors.college}</div>}
              </div>

              {/* Country */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>Country *</label>
                <select
                  value={profileForm.country}
                  onChange={(e) => setProfileForm({ ...profileForm, country: e.target.value })}
                  style={{ ...inputStyle, cursor: 'pointer', background: '#fff' }}
                >
                  <option value="">Select your country…</option>
                  {COUNTRY_NAMES.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                {profileErrors.country && <div style={errorStyle}>{profileErrors.country}</div>}
              </div>

              {/* City */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>City *</label>
                <input
                  type="text"
                  placeholder="E.g., Mumbai"
                  value={profileForm.city}
                  onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                  style={inputStyle}
                />
                {profileErrors.city && <div style={errorStyle}>{profileErrors.city}</div>}
              </div>

              {/* Referral Code */}
              <div style={{ marginBottom: '2rem' }}>
                <label style={{ fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>Referral Code (optional)</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Enter referral code if you have one"
                    value={referralCodeInput}
                    onChange={async (e) => {
                      const val = e.target.value.toUpperCase();
                      setReferralCodeInput(val);
                      if (!val.trim()) { setReferralCheckStatus('idle'); return; }
                      setReferralCheckStatus('checking');
                      const matched = await isReferralCodeMatched(val);
                      setReferralCheckStatus(matched ? 'matched' : 'not_matched');
                    }}
                    style={{
                      ...inputStyle,
                      borderColor: referralCheckStatus === 'matched' ? '#34A853' : referralCheckStatus === 'not_matched' ? '#EA4335' : inputStyle.borderColor,
                    }}
                  />
                  <div style={{ fontSize: '0.75rem', marginTop: '0.3rem', fontWeight: 700 }}>
                    {referralCheckStatus === 'checking' && <span style={{ color: '#888' }}>Checking...</span>}
                    {referralCheckStatus === 'matched' && <span style={{ color: '#34A853' }}>Referral code matched! Discount QR will be applied.</span>}
                    {referralCheckStatus === 'not_matched' && <span style={{ color: '#EA4335' }}>Referral code didn't match. Default payment will be used.</span>}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="btn-sharp"
                style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', fontWeight: 'bold' }}
                disabled={profileSaving}
              >
                {profileSaving ? 'Saving Details...' : 'Save & Continue →'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
