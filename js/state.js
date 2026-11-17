// Ang lahat ng live na data ay nandito. Pinupunan ito ng data.js mula sa Firestore.
export const DB = {
  apps: [], logins: [], services: [], envs: [], files: [], changelog: [], renewals: [],
  clients: [], billing: [], users: [], invites: [], audit: [],
  settings: null, vault: null,
};
// keySalt = salt ng passphrase na ginamit sa key. rotating = true habang nagpapalit ng passphrase. relocked = na-lock dahil may nagpalit.
export const ctx = { user: null, profile: null, key: null, keySalt: null, rotating: false, relocked: false, pending: new Set() };
export const ui = {
  view: 'dashboard', appId: null, tab: 'overview', clientId: null,
  pf: 'all', rf: 'all', logApp: 'all', logType: 'all',
  appFilter: 'all', tagFilter: '', showArchived: false, q: '',
};
export const isAdmin = () => !!(ctx.profile && ctx.profile.role === 'admin');

export const HOSTS = ['Netlify', 'Vercel', 'Cloudflare Pages', 'Cloudflare Workers', 'GitHub Pages', 'Firebase Hosting', 'Render', 'Railway', 'Fly.io', 'Hostinger / cPanel', 'DigitalOcean', 'AWS Amplify', 'Heroku', 'Other'];
export const SVC_TYPES = ['Hosting', 'Domain / DNS', 'Database', 'Storage', 'Firebase', 'Supabase', 'AI / LLM', 'API key', 'Email / SMTP', 'Payments', 'Analytics', 'Auth', 'Other'];
export const PROVIDERS = ['Firebase', 'Supabase', 'Anthropic', 'OpenAI', 'Google Gemini', 'Cloudinary', 'AWS S3', 'Cloudflare R2', 'Backblaze B2', 'MongoDB Atlas', 'Neon', 'PlanetScale', 'Namecheap', 'GoDaddy', 'Cloudflare', 'Hostinger', 'Resend', 'SendGrid', 'Mailgun', 'Stripe', 'PayMongo', 'PayPal', 'Xendit', 'Google Analytics', 'Clerk', 'Auth0', 'Twilio', 'Semaphore'];
export const LOGIN_ROLES = ['Developer', 'Admin', 'Staff', 'Client / User', 'Database', 'Other'];
export const STATUSES = [['live', 'Live'], ['dev', 'In development'], ['maint', 'Maintenance'], ['paused', 'Paused'], ['archived', 'Archived']];
export const KINDS = ['Subscription', 'Maintenance plan', 'Hosting renewal', 'Domain renewal', 'One-time project fee', 'Service cost', 'Other'];
export const LOG_TYPES = ['Feature', 'Improvement', 'Fix', 'Update', 'Security'];
export const RENEW_KINDS = ['Domain', 'SSL certificate', 'Hosting', 'Other'];

export const DEFAULT_SETTINGS = {
  currency: '₱', warnDays: 7, renewWarnDays: 30,
  businessName: '', businessContact: '', payInfo: '',
  msgDue: 'Hello po {client}, magandang araw! Paalala lang po na ang {title} para sa {app} na {balance} ay due na sa {due_date}. {pay_info}\n\nSalamat po! — {business}',
  msgOverdue: 'Hello po {client}, magandang araw po. Overdue na po ang {title} para sa {app} ({balance}) na dapat bayaran noong {due_date}. {pay_info}\n\nPaki-send na lang po ang proof of payment pagkatapos. Salamat po! — {business}',
  msgReceipt: 'Hello po {client}, natanggap na po namin ang bayad ninyong {paid} para sa {title}. Resibo no. {receipt_no}. Maraming salamat po! — {business}',
};
export const cfg = () => Object.assign({}, DEFAULT_SETTINGS, DB.settings || {});
