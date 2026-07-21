type TranslationMap = Record<string, string>;

const en: TranslationMap = {
  'nav.console': 'Guard Console',
  'nav.approvals': 'Approvals',
  'nav.inside': "Who's Inside",
  'nav.reports': 'Reports',
  'nav.analytics': 'Analytics',
  'nav.gatepass': 'Gate Passes',
  'nav.admin': 'Admin',
  'nav.logout': 'Sign Out',
  'nav.login': 'Sign In',
  'guard.total': 'Total',
  'guard.inside': 'Inside',
  'guard.pending': 'Pending',
  'guard.approved': 'Approved',
  'guard.register': 'Register Visitor',
  'guard.exit': 'Log Exit',
  'guard.checkin': 'Check In',
  'guard.badge': 'Print Badge',
  'guard.refresh': 'Refresh',
  'hod.pending_review': 'pending review',
  'hod.caught_up': 'All caught up',
  'hod.no_pending': 'No pending approvals right now',
  'hod.approve': 'Approve',
  'hod.reject': 'Reject',
  'visit.checked_in': 'Checked In',
  'visit.checked_out': 'Checked Out',
  'visit.pending_approval': 'Pending Approval',
  'visit.approved': 'Approved',
  'visit.rejected': 'Rejected',
  'common.loading': 'Loading...',
  'common.error': 'Error',
  'common.dismiss': 'Dismiss',
  'common.submit': 'Submit',
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.save': 'Save',
  'common.delete': 'Delete',
  'common.search': 'Search',
  'common.filter': 'Filter',
  'common.clear': 'Clear',
  'common.no_data': 'No data available',
  'duration.hours': 'h',
  'duration.minutes': 'm',
  'duration.overtime': '\u26a0\ufe0f Over 9 hours',
  'export.csv': 'Export CSV',
  'export.json': 'Export JSON',
  'lang.english': 'English',
  'lang.hindi': '\u0939\u093f\u0928\u094d\u0926\u0940',
};

const hi: TranslationMap = {
  'nav.console': '\u0917\u093e\u0930\u094d\u0921 \u0915\u0902\u0938\u094b\u0932',
  'nav.approvals': '\u0905\u0928\u0941\u092e\u094b\u0926\u0928',
  'nav.inside': '\u0905\u0902\u0926\u0930 \u0915\u094c\u0928 \u0939\u0948',
  'nav.reports': '\u0930\u093f\u092a\u094b\u0930\u094d\u091f',
  'nav.analytics': '\u090f\u0928\u093e\u0932\u093f\u091f\u093f\u0915\u094d\u0938',
  'nav.gatepass': '\u0917\u0947\u091f \u092a\u093e\u0938',
  'nav.admin': '\u092a\u094d\u0930\u0936\u093e\u0938\u0928',
  'nav.logout': '\u0938\u093e\u0907\u0928 \u0906\u0909\u091f',
  'nav.login': '\u0938\u093e\u0907\u0928 \u0907\u0928',
  'guard.total': '\u0915\u0941\u0932',
  'guard.inside': '\u0905\u0902\u0926\u0930',
  'guard.pending': '\u0932\u0902\u092c\u093f\u0924',
  'guard.approved': '\u0905\u0928\u0941\u092e\u094b\u0926\u093f\u0924',
  'guard.register': '\u0906\u0917\u0902\u0924\u0941\u0915 \u092a\u0902\u091c\u0940\u0915\u0930\u0923',
  'guard.exit': '\u0928\u093f\u0915\u093e\u0938 \u0932\u0949\u0917',
  'guard.checkin': '\u091a\u0947\u0915 \u0907\u0928',
  'guard.badge': '\u092c\u0948\u091c \u092a\u094d\u0930\u093f\u0902\u091f \u0915\u0930\u0947\u0902',
  'guard.refresh': '\u0930\u093f\u092b\u094d\u0930\u0947\u0936',
  'hod.pending_review': '\u0938\u092e\u0940\u0915\u094d\u0937\u093e \u0939\u0947\u0924\u0941 \u0932\u0902\u092c\u093f\u0924',
  'hod.caught_up': '\u0938\u092d\u0940 \u0928\u093f\u092a\u091f\u093e\u090f \u0917\u090f',
  'hod.no_pending': '\u0905\u092d\u0940 \u0915\u094b\u0908 \u0932\u0902\u092c\u093f\u0924 \u0905\u0928\u0941\u092e\u094b\u0926\u0928 \u0928\u0939\u0940\u0902',
  'hod.approve': '\u0905\u0928\u0941\u092e\u094b\u0926\u093f\u0924 \u0915\u0930\u0947\u0902',
  'hod.reject': '\u0905\u0938\u094d\u0935\u0940\u0915\u093e\u0930 \u0915\u0930\u0947\u0902',
  'visit.checked_in': '\u091a\u0947\u0915 \u0907\u0928 \u0915\u093f\u092f\u093e',
  'visit.checked_out': '\u091a\u0947\u0915 \u0906\u0909\u091f \u0915\u093f\u092f\u093e',
  'visit.pending_approval': '\u0905\u0928\u0941\u092e\u094b\u0926\u0928 \u0932\u0902\u092c\u093f\u0924',
  'visit.approved': '\u0905\u0928\u0941\u092e\u094b\u0926\u093f\u0924',
  'visit.rejected': '\u0905\u0938\u094d\u0935\u0940\u0915\u0943\u0924',
  'common.loading': '\u0932\u094b\u0921 \u0939\u094b \u0930\u0939\u093e \u0939\u0948...',
  'common.error': '\u0924\u094d\u0930\u0941\u091f\u093f',
  'common.dismiss': '\u0916\u093e\u0930\u093f\u091c \u0915\u0930\u0947\u0902',
  'common.submit': '\u091c\u092e\u093e \u0915\u0930\u0947\u0902',
  'common.cancel': '\u0930\u0926\u094d\u0926 \u0915\u0930\u0947\u0902',
  'common.close': '\u092c\u0902\u0926 \u0915\u0930\u0947\u0902',
  'common.save': '\u0938\u0939\u0947\u091c\u0947\u0902',
  'common.delete': '\u0939\u091f\u093e\u090f\u0902',
  'common.search': '\u0916\u094b\u091c\u0947\u0902',
  'common.filter': '\u092b\u093c\u093f\u0932\u094d\u091f\u0930',
  'common.clear': '\u0938\u093e\u092b\u093c \u0915\u0930\u0947\u0902',
  'common.no_data': '\u0915\u094b\u0908 \u0921\u0947\u091f\u093e \u0909\u092a\u0932\u092c\u094d\u0927 \u0928\u0939\u0940\u0902',
  'duration.hours': '\u0918\u0902\u091f\u0947',
  'duration.minutes': '\u092e\u093f\u0928\u091f',
  'duration.overtime': '\u26a0\ufe0f 9 \u0918\u0902\u091f\u0947 \u0938\u0947 \u0905\u0927\u093f\u0915',
  'export.csv': 'CSV \u0928\u093f\u0930\u094d\u092f\u093e\u0924',
  'export.json': 'JSON \u0928\u093f\u0930\u094d\u092f\u093e\u0924',
  'lang.english': '\u0905\u0902\u0917\u094d\u0930\u0947\u091c\u093c\u0940',
  'lang.hindi': '\u0939\u093f\u0928\u094d\u0926\u0940',
};

const languages: Record<string, TranslationMap> = { en, hi };
const STORAGE_KEY = 'vms_language';

function getBrowserLang(): string {
  try {
    const lang = navigator.language?.slice(0, 2);
    return lang === 'hi' ? 'hi' : 'en';
  } catch { return 'en'; }
}

export function getStoredLanguage(): string {
  try { return localStorage.getItem(STORAGE_KEY) ?? getBrowserLang(); }
  catch { return 'en'; }
}

export function setStoredLanguage(lang: string): void {
  try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* noop */ }
}

let currentLang = getStoredLanguage();
const listeners = new Set<() => void>();

export function setLanguage(lang: string): void {
  currentLang = lang;
  setStoredLanguage(lang);
  listeners.forEach((fn) => fn());
}

export function getLanguage(): string {
  return currentLang;
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function t(key: string): string {
  return languages[currentLang]?.[key] ?? languages.en?.[key] ?? key;
}
