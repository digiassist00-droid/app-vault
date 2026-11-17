// Login, Join, email verification, at Google Authenticator (Firebase TOTP MFA).
import {
  auth, db, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  sendEmailVerification, sendPasswordResetEmail, updateProfile, getMultiFactorResolver, multiFactor,
  TotpMultiFactorGenerator, doc, getDoc, setDoc, writeBatch, serverTimestamp,
} from './firebase.js';
import { OPTIONS, isConfigured } from './config.js';
import { ctx } from './state.js';
import { esc, strength } from './util.js';
import { ic, logo } from './icons.js';

export const authState = { stage: 'loading', tab: 'login', notice: '', error: '', busy: false, resolver: null, enroll: null };
let cb = { ready: () => {}, change: () => {}, reset: () => {} };

function setStage(stage, extra) {
  authState.stage = stage;
  authState.error = '';
  authState.busy = false;
  if (extra) Object.assign(authState, extra);
  cb.change();
  if (stage === 'enroll' && !authState.enroll) startEnroll();
}

export function friendly(e) {
  const c = (e && e.code) || '';
  const m = {
    'auth/invalid-credential': 'Wrong email or password.',
    'auth/wrong-password': 'Wrong email or password.',
    'auth/user-not-found': 'Wrong email or password.',
    'auth/invalid-email': 'That email does not look right.',
    'auth/email-already-in-use': 'That email already has an account. Use Sign in.',
    'auth/weak-password': 'Use a stronger password (at least 8 characters).',
    'auth/too-many-requests': 'Too many tries. Wait a few minutes and try again.',
    'auth/invalid-verification-code': 'That code is wrong or expired. Try the next one.',
    'auth/code-expired': 'That code expired. Try the next one.',
    'auth/operation-not-allowed': 'This is not switched on in Firebase yet. Check README steps 3 and 4.',
    'auth/requires-recent-login': 'For safety, please sign in again and retry.',
    'auth/network-request-failed': 'No connection. Check your internet.',
    'auth/unverified-email': 'Verify your email first.',
  };
  return m[c] || (e && e.message) || 'Something went wrong.';
}

export function initAuth(callbacks) {
  cb = callbacks;
  if (!isConfigured()) { setStage('config'); return; }
  onAuthStateChanged(auth, (user) => { handleUser(user).catch((e) => { console.error(e); setStage('login', { error: friendly(e) }); }); });
}

async function handleUser(user) {
  cb.reset();
  ctx.user = user;
  ctx.profile = null;
  if (!user) {
    if (authState.stage !== 'mfa') setStage(authState.stage === 'join' ? 'join' : 'login');
    return;
  }
  if (!user.emailVerified) { setStage('verify'); return; }
  const tok = await user.getIdTokenResult();
  const second = tok.claims.firebase && tok.claims.firebase.sign_in_second_factor;
  if (OPTIONS.require2FA && second !== 'totp') {
    if (multiFactor(user).enrolledFactors.length === 0) { authState.enroll = null; setStage('enroll'); return; }
    await signOut(auth);
    setStage('login', { tab: 'login', notice: 'Please sign in again and enter your authenticator code.' });
    return;
  }
  await loadProfile(user);
}

async function loadProfile(user) {
  const uref = doc(db, 'users', user.uid);
  let snap = await getDoc(uref);
  if (!snap.exists()) {
    const base = { email: String(user.email).toLowerCase(), name: user.displayName || String(user.email).split('@')[0], createdAt: serverTimestamp() };
    try {
      const setup = await getDoc(doc(db, 'meta', 'setup'));
      if (!setup.exists()) {
        const b = writeBatch(db);
        b.set(uref, Object.assign({}, base, { role: 'admin' }));
        b.set(doc(db, 'meta', 'setup'), { adminUid: user.uid, createdAt: serverTimestamp() });
        await b.commit();
      } else {
        await setDoc(uref, Object.assign({}, base, { role: 'developer' }));
      }
    } catch (e) {
      console.error(e);
      setStage('denied');
      return;
    }
    snap = await getDoc(uref);
  }
  ctx.profile = Object.assign({ id: snap.id }, snap.data());
  authState.enroll = null;
  setStage('ready');
  cb.ready();
}

/* ---------- actions ---------- */
const val = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
const busy = (on) => { authState.busy = on; const b = document.getElementById('auth-go'); if (b) b.disabled = on; };
const fail = (m) => { authState.error = m; const e = document.getElementById('auth-msg'); if (e) e.textContent = m; busy(false); };

export async function submitLogin() {
  const email = val('li-email').trim(), pass = val('li-pass');
  if (!email || !pass) return fail('Enter your email and password.');
  busy(true); authState.notice = '';
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    if (e && e.code === 'auth/multi-factor-auth-required') {
      authState.resolver = getMultiFactorResolver(auth, e);
      setStage('mfa');
      return;
    }
    fail(friendly(e));
  }
}
export async function submitJoin() {
  const name = val('jn-name').trim(), email = val('jn-email').trim(), p1 = val('jn-pass'), p2 = val('jn-pass2');
  if (!name || !email) return fail('Enter your name and email.');
  if (p1.length < 8) return fail('Use at least 8 characters for the password.');
  if (p1 !== p2) return fail('The two passwords do not match.');
  busy(true);
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, p1);
    await updateProfile(cred.user, { displayName: name });
    await sendEmailVerification(cred.user);
  } catch (e) { fail(friendly(e)); }
}
export async function submitMfa() {
  const code = val('mf-code').replace(/\s/g, '');
  if (!/^\d{6}$/.test(code)) return fail('Type the 6-digit code from Google Authenticator.');
  busy(true);
  try {
    const r = authState.resolver;
    const hint = r.hints.find((h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID) || r.hints[0];
    await r.resolveSignIn(TotpMultiFactorGenerator.assertionForSignIn(hint.uid, code));
    authState.resolver = null;
  } catch (e) { fail(friendly(e)); }
}
export async function resend() {
  try { await sendEmailVerification(auth.currentUser); authState.notice = 'Verification email sent. Check your inbox and spam.'; cb.change(); } catch (e) { fail(friendly(e)); }
}
export async function checkVerified() {
  busy(true);
  try {
    await auth.currentUser.reload();
    await auth.currentUser.getIdToken(true);
    if (!auth.currentUser.emailVerified) { authState.notice = ''; return fail('Not verified yet. Open the link in the email first.'); }
    await handleUser(auth.currentUser);
  } catch (e) { fail(friendly(e)); }
}
export async function forgot() {
  const email = val('li-email').trim();
  if (!email) return fail('Type your email above first.');
  try { await sendPasswordResetEmail(auth, email); authState.notice = 'If that email has an account, a reset link is on its way.'; authState.error = ''; cb.change(); } catch (e) { fail(friendly(e)); }
}
export async function doSignOut() {
  authState.enroll = null; authState.resolver = null; authState.notice = '';
  await signOut(auth);
  setStage('login', { tab: 'login' });
}
export function setTab(t) { authState.tab = t; authState.error = ''; authState.notice = ''; setStage(t); }

async function makeQR(text) {
  try {
    const mod = await import('https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/+esm');
    const qrcode = mod.default || mod;
    const q = qrcode(0, 'M');
    q.addData(text); q.make();
    const n = q.getModuleCount(), m = 3;
    let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += 'M' + (c + m) + ',' + (r + m) + 'h1v1h-1z';
    return '<svg class="qr" viewBox="0 0 ' + (n + 2 * m) + ' ' + (n + 2 * m) + '" shape-rendering="crispEdges" role="img" aria-label="Authenticator QR code"><rect width="100%" height="100%" fill="#ffffff"/><path d="' + d + '" fill="#0b1220"/></svg>';
  } catch (e) { return ''; }
}
async function startEnroll() {
  try {
    const session = await multiFactor(auth.currentUser).getSession();
    const secret = await TotpMultiFactorGenerator.generateSecret(session);
    const url = secret.generateQrCodeUrl(auth.currentUser.email, OPTIONS.issuer);
    authState.enroll = { secret, key: secret.secretKey, qr: await makeQR(url) };
  } catch (e) {
    authState.enroll = { error: friendly(e) };
  }
  cb.change();
}
export async function submitEnroll() {
  const code = val('en-code').replace(/\s/g, '');
  if (!/^\d{6}$/.test(code)) return fail('Type the 6-digit code from Google Authenticator.');
  busy(true);
  try {
    const a = TotpMultiFactorGenerator.assertionForEnrollment(authState.enroll.secret, code);
    await multiFactor(auth.currentUser).enroll(a, 'Google Authenticator');
    authState.enroll = null;
    await signOut(auth);
    setStage('login', { tab: 'login', notice: 'Two-step login is on. Sign in again and enter a fresh code.' });
  } catch (e) { fail(friendly(e)); }
}

/* ---------- screens ---------- */
const brand = '<div class="authbrand">' + logo() + '<b>App Vault</b></div>';
const msgs = () => '<div class="msg" id="auth-msg" role="alert">' + esc(authState.error) + '</div>' + (authState.notice ? '<div class="note">' + esc(authState.notice) + '</div>' : '');
const tabs = () => '<div class="authtabs"><button type="button" class="' + (authState.tab === 'login' ? 'on' : '') + '" data-act="authTab" data-v="login">Sign in</button><button type="button" class="' + (authState.tab === 'join' ? 'on' : '') + '" data-act="authTab" data-v="join">Join</button></div>';

export function authHTML() {
  const s = authState;
  let inner = '';
  if (s.stage === 'loading') inner = brand + '<div class="loading"><i></i><span>Loading…</span></div>';
  else if (s.stage === 'config') {
    inner = brand + '<div><h1>Connect Firebase</h1><p class="sub">Open <code>js/config.js</code>, paste your Firebase web config, then redeploy. The README has the steps.</p></div>';
  } else if (s.stage === 'login') {
    inner = brand + tabs() + '<form id="f-login" novalidate><div class="fld"><label for="li-email">Email</label><input id="li-email" type="email" autocomplete="username"></div><div class="fld"><label for="li-pass">Password</label><div class="pw"><input id="li-pass" type="password" autocomplete="current-password"><button type="button" class="icon-btn" data-act="tpw" data-t="li-pass" title="Show or hide">' + ic('eye') + '</button></div></div>' + msgs() + '<button class="btn pri block" id="auth-go">Sign in</button></form><button class="linkbtn" data-act="forgot">Forgot password?</button>';
  } else if (s.stage === 'join') {
    inner = brand + tabs() + '<p class="sub">New here? The first person to join becomes the admin. Everyone else needs an invite from the admin, so use the email you were invited with.</p><form id="f-join" novalidate><div class="fld"><label for="jn-name">Your name</label><input id="jn-name" type="text" autocomplete="name"></div><div class="fld"><label for="jn-email">Email</label><input id="jn-email" type="email" autocomplete="username"></div><div class="fld"><label for="jn-pass">Password</label><div class="pw"><input id="jn-pass" type="password" autocomplete="new-password"><button type="button" class="icon-btn" data-act="tpw" data-t="jn-pass" title="Show or hide">' + ic('eye') + '</button></div><div class="meter"><i id="meter"></i></div></div><div class="fld"><label for="jn-pass2">Repeat password</label><input id="jn-pass2" type="password" autocomplete="new-password"></div>' + msgs() + '<button class="btn pri block" id="auth-go">Create account</button></form>';
  } else if (s.stage === 'mfa') {
    inner = brand + '<div><h1>Two-step check</h1><p class="sub">Open Google Authenticator and type the 6-digit code for App Vault.</p></div><form id="f-mfa" novalidate><div class="fld"><label for="mf-code">Code</label><input id="mf-code" class="codein" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="7" placeholder="000000"></div>' + msgs() + '<button class="btn pri block" id="auth-go">Verify</button></form><button class="linkbtn" data-act="signout">Cancel</button>';
  } else if (s.stage === 'verify') {
    inner = brand + '<div><h1>Verify your email</h1><p class="sub">We sent a link to <b>' + esc(ctx.user ? ctx.user.email : '') + '</b>. Open it, then come back and press the button.</p></div>' + msgs() + '<button class="btn pri block" id="auth-go" data-act="checkVerified">I verified, continue</button><div class="pact" style="justify-content:space-between"><button class="linkbtn" data-act="resend">Send the email again</button><button class="linkbtn" data-act="signout">Sign out</button></div>';
  } else if (s.stage === 'enroll') {
    const e = s.enroll;
    let box;
    if (!e) box = '<div class="loading"><i></i><span>Preparing…</span></div>';
    else if (e.error) box = '<div class="msg">' + esc(e.error) + '</div><button class="linkbtn" data-act="signout">Sign out</button>';
    else box = '<ol class="steps"><li>Open Google Authenticator and tap +.</li><li>' + (e.qr ? 'Scan the square below, or choose Enter a setup key.' : 'Choose Enter a setup key and type the key below.') + '</li><li>Type the 6-digit code it shows.</li></ol><div class="qrwrap">' + e.qr + '<div style="min-width:0;flex:1"><span class="lbl">Setup key</span><div class="key">' + esc(String(e.key).replace(/(.{4})/g, '$1 ').trim()) + '</div><p class="hint" style="margin-top:8px">Tip: add it to two phones now by scanning the same square on both. If you lose one phone, the other still works.</p></div></div><form id="f-enroll" novalidate><div class="fld"><label for="en-code">6-digit code</label><input id="en-code" class="codein" type="text" inputmode="numeric" autocomplete="off" maxlength="7" placeholder="000000"></div>' + msgs() + '<button class="btn pri block" id="auth-go">Turn on two-step login</button></form>';
    inner = brand + '<div><h1>Set up two-step login</h1><p class="sub">Everyone must use Google Authenticator. This protects the vault even if a password leaks.</p></div>' + box;
  } else if (s.stage === 'denied') {
    inner = brand + '<div><h1>Not invited yet</h1><p class="sub">This email was not invited. Ask the admin to add <b>' + esc(ctx.user ? ctx.user.email : '') + '</b> under Settings → Team, then sign in again.</p></div><button class="btn block" data-act="signout">Sign out</button>';
  }
  return '<div class="auth"><div class="auth-card">' + inner + '</div></div>';
}

export function meterUpdate(v) {
  const m = document.getElementById('meter');
  if (!m) return;
  const s = strength(v);
  m.style.width = (s * 25) + '%';
  m.style.background = s < 2 ? 'var(--bad)' : s < 3 ? 'var(--warn-solid)' : 'var(--good)';
}
