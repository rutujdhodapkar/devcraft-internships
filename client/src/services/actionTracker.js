const PORTFOLIO_RTDB = 'https://portfolio-cfe62-default-rtdb.firebaseio.com';
const ACTION_STORAGE_KEY = 'devcraft_action_log';
const API_BASE = (import.meta.env.VITE_SERVER_URL || 'https://devcraft.fennark.xyz').replace(/\/api\/?$/, '');

const CATEGORIES = {
  login: 'login',
  internshipApplication: 'internship_application',
  taskCompleted: 'task_completed',
  allTasksDoneNoPayment: 'all_tasks_done_no_payment',
  allDoneWithPayment: 'all_done_with_payment',
  paymentPending: 'payment_pending',
  paymentSuccess: 'payment_success',
  certificateIssued: 'certificate_issued',
  referralSignup: 'referral_signup',
  profileUpdated: 'profile_updated',
  internshipExpired: 'internship_expired',
  deadlineApproaching: 'deadline_approaching',
  welcome: 'welcome',
  adminNotification: 'admin_notification',
};

function _sanitizeEmail(email) {
  return (email || '').toLowerCase().replace(/\./g, ',').replace(/[^a-z0-9,]/g, '_');
}

function nowIST() {
  const d = new Date();
  const ist = new Date(d.getTime() + (5.5 * 60 * 60 * 1000));
  return ist.toISOString().replace('T', ' ').slice(0, 19) + ' IST';
}

async function rtdbPut(category, userEmail, data) {
  const key = _sanitizeEmail(userEmail);
  const ts = new Date().toISOString();
  const payload = { ...data, category, key, createdAt: ts, createdAtIST: nowIST() };
  try {
    const res = await fetch(`${PORTFOLIO_RTDB}/emailCategories/${category}/${key}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) return { id: key, ...payload };
    console.warn('[ActionTracker] RTDB PUT failed:', res.status, await res.text().catch(() => ''));
  } catch (e) {
    console.warn('[ActionTracker] RTDB write failed:', e.message);
  }
  return null;
}

function lsPut(category, userEmail, data) {
  try {
    const key = _sanitizeEmail(userEmail);
    const storeKey = `${ACTION_STORAGE_KEY}_${category}_${key}`;
    localStorage.setItem(storeKey, JSON.stringify({ ...data, category, key, _localTs: Date.now(), _updatedAt: new Date().toISOString() }));
  } catch (e) { console.warn('[ActionTracker] localStorage write failed:', e.message); }
}

async function triggerEmail(category, userData, details) {
  try {
    await fetch(`${API_BASE}/api/action-tracker/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, userData, details }),
    });
  } catch (e) {
    console.warn('[ActionTracker] Email trigger failed:', e.message);
  }
}

export async function trackLogin(user) {
  if (!user?.email) return null;
  const data = {
    email: user.email, name: user.displayName || user.email,
    uid: user.uid || '', photoURL: user.photoURL || '',
  };
  const r = await rtdbPut('login', user.email, data);
  lsPut('login', user.email, data);
  await triggerEmail('login', data, { action: 'User logged in' });
  return r;
}

export async function trackInternshipApplication(user, enrollment, domain) {
  if (!user?.email || !enrollment?.id) return null;
  const data = {
    email: user.email, name: user.displayName || user.email, uid: user.uid || '',
    domain: domain?.title || enrollment.domain || '', domainId: domain?.id || enrollment.domainId || '',
    internId: enrollment.internId || enrollment.id, referralCode: enrollment.referralCode || '',
    paymentAmount: enrollment.paymentAmount || 0, paymentTiming: enrollment.paymentTiming || 'end',
    deadline: enrollment.deadline || '', duration: enrollment.duration || '',
  };
  const r = await rtdbPut('internship_application', user.email, data);
  lsPut('internship_application', user.email, data);
  await triggerEmail('internship_application', data, { action: 'Applied for internship', domain: data.domain, internId: data.internId });
  return r;
}

export async function trackTaskCompleted(user, enrollment, projectIndex, projectTitle) {
  if (!user?.email || !enrollment?.id) return null;
  const data = {
    email: user.email, name: user.displayName || user.email, uid: user.uid || '',
    domain: enrollment.domain || '', domainId: enrollment.domainId || '',
    internId: enrollment.internId || enrollment.id, taskNumber: projectIndex + 1,
    taskTitle: projectTitle || `Task ${projectIndex + 1}`,
    totalTasks: (enrollment.projects || []).length,
    completedTasks: Object.values(enrollment.submissions || {}).filter(s => s?.submittedAt).length + 1,
    deadline: enrollment.deadline || '',
  };
  const r = await rtdbPut('task_completed', user.email, data);
  lsPut('task_completed', user.email, data);
  await triggerEmail('task_completed', data, { action: 'Task completed', taskNumber: data.taskNumber, taskTitle: data.taskTitle });
  return r;
}

export async function trackAllTasksDoneNoPayment(user, enrollment) {
  if (!user?.email || !enrollment?.id) return null;
  const data = {
    email: user.email, name: user.displayName || user.email, uid: user.uid || '',
    domain: enrollment.domain || '', domainId: enrollment.domainId || '',
    internId: enrollment.internId || enrollment.id, totalTasks: (enrollment.projects || []).length,
    paymentStatus: enrollment.paymentStatus || 'none', paymentAmount: enrollment.paymentAmount || 0,
    paymentTiming: enrollment.paymentTiming || 'end', deadline: enrollment.deadline || '',
  };
  const r = await rtdbPut('all_tasks_done_no_payment', user.email, data);
  lsPut('all_tasks_done_no_payment', user.email, data);
  await triggerEmail('all_tasks_done_no_payment', data, { action: 'All tasks done, payment pending', domain: data.domain, amount: data.paymentAmount });
  return r;
}

export async function trackAllDoneWithPayment(user, enrollment) {
  if (!user?.email || !enrollment?.id) return null;
  const data = {
    email: user.email, name: user.displayName || user.email, uid: user.uid || '',
    domain: enrollment.domain || '', domainId: enrollment.domainId || '',
    internId: enrollment.internId || enrollment.id, totalTasks: (enrollment.projects || []).length,
    paymentStatus: 'paid', paymentAmount: enrollment.paymentAmount || 0,
    completedAt: new Date().toISOString(), certificateIssued: enrollment.allowedCertificate === 'yes',
  };
  const r = await rtdbPut('all_done_with_payment', user.email, data);
  lsPut('all_done_with_payment', user.email, data);
  await triggerEmail('all_done_with_payment', data, { action: 'Internship completed with payment', domain: data.domain });
  return r;
}

export async function trackPaymentPending(user, enrollment) {
  if (!user?.email || !enrollment?.id) return null;
  const data = {
    email: user.email, name: user.displayName || user.email, uid: user.uid || '',
    domain: enrollment.domain || '', internId: enrollment.internId || enrollment.id,
    paymentStatus: enrollment.paymentStatus || 'pending', paymentAmount: enrollment.paymentAmount || 0,
    paymentStage: enrollment.paymentStage || 'none',
  };
  const r = await rtdbPut('payment_pending', user.email, data);
  lsPut('payment_pending', user.email, data);
  await triggerEmail('payment_pending', data, { action: 'Payment initiated', amount: data.paymentAmount });
  return r;
}

export async function trackPaymentSuccess(user, enrollment) {
  if (!user?.email || !enrollment?.id) return null;
  const data = {
    email: user.email, name: user.displayName || user.email, uid: user.uid || '',
    domain: enrollment.domain || '', internId: enrollment.internId || enrollment.id,
    paymentAmount: enrollment.paymentAmount || 0, paidAt: new Date().toISOString(),
  };
  const r = await rtdbPut('payment_success', user.email, data);
  lsPut('payment_success', user.email, data);
  await triggerEmail('payment_success', data, { action: 'Payment successful', amount: data.paymentAmount });
  return r;
}

export async function trackCertificateIssued(user, enrollment) {
  if (!user?.email || !enrollment?.id) return null;
  const data = {
    email: user.email, name: user.displayName || user.email, uid: user.uid || '',
    domain: enrollment.domain || '', internId: enrollment.internId || enrollment.id,
    issuedAt: new Date().toISOString(),
  };
  const r = await rtdbPut('certificate_issued', user.email, data);
  lsPut('certificate_issued', user.email, data);
  await triggerEmail('certificate_issued', data, { action: 'Certificate issued', domain: data.domain });
  return r;
}

export async function trackReferralSignup(user, referralCode) {
  if (!user?.email || !referralCode) return null;
  const data = { email: user.email, name: user.displayName || user.email, uid: user.uid || '', referralCode };
  const r = await rtdbPut('referral_signup', user.email, data);
  lsPut('referral_signup', user.email, data);
  await triggerEmail('referral_signup', data, { action: 'Signed up via referral', referralCode });
  return r;
}

export async function trackProfileUpdated(user) {
  if (!user?.email) return null;
  const data = { email: user.email, name: user.displayName || user.email, uid: user.uid || '' };
  const r = await rtdbPut('profile_updated', user.email, data);
  lsPut('profile_updated', user.email, data);
  return r;
}

export async function trackInternshipExpired(user, enrollment) {
  if (!user?.email || !enrollment?.id) return null;
  const data = {
    email: user.email, name: user.displayName || user.email, uid: user.uid || '',
    domain: enrollment.domain || '', internId: enrollment.internId || enrollment.id,
    deadline: enrollment.deadline || '', expiredAt: new Date().toISOString(),
  };
  const r = await rtdbPut('internship_expired', user.email, data);
  lsPut('internship_expired', user.email, data);
  return r;
}

export async function getActionLog(category) {
  try {
    const storeKey = category
      ? `${ACTION_STORAGE_KEY}_${category}_`
      : ACTION_STORAGE_KEY;
    const results = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(storeKey)) {
        try { results.push(JSON.parse(localStorage.getItem(key))); } catch {}
      }
    }
    return results;
  } catch { return []; }
}

export async function getActionsByCategory(category) {
  return getActionLog(category);
}

export { CATEGORIES };
