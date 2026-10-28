/**
 * FinRoute Localization Dictionary (i18n)
 * Supported Languages: English (en), Telugu (te)
 */

export const AVAILABLE_LANGUAGES = [
  { code: 'en', label: 'English', native: 'English', flag: '🇬🇧' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు', flag: '🇮🇳' },
];

export const translations = {
  en: {
    app: {
      title: 'FinRoute',
      tagline: 'Microfinance & Weekly Collection Tracker',
      collector: 'finroute-collector',
    },
    nav: {
      tracker: 'Weekly Tracker',
      archive: 'Loan Archive',
      settings: 'Settings',
      superAdmin: 'Super Admin',
      logout: 'Logout',
      tenant: 'Tenant Branch',
    },
    kpis: {
      originalAmount: 'Original Capital',
      totalDisbursed: 'Total Disbursed',
      totalPayable: 'Total Payable',
      totalCollected: 'Total Collections',
      totalOutstanding: 'Outstanding Balance',
      balanceDue: 'Balance Due',
      netCash: 'Net Cash in Hand',
      weeklyTarget: 'Weekly Target',
      activeLoans: 'Active Loans',
      paidOffLoans: 'Paid Off Loans',
      collectionRate: 'Collection Rate',
    },
    toolbar: {
      searchPlaceholder: 'Search customer (తెలుగు / Eng), Phone, ID...',
      allStatuses: 'All Statuses',
      activeOnly: 'Active Loans Only',
      paidOffOnly: 'Paid Off Only',
      filterVillage: 'Filter by Village',
      allVillages: 'All Villages',
    },
    actions: {
      addCustomer: 'Add Customer',
      addVillage: 'Add Village Row',
      addWeek: 'Add Week',
      deleteWeek: 'Delete Week',
      archiveRenew: 'Archive & Renew',
      exportPdf: 'Download PDF',
      exportCsv: 'Export CSV',
      importSheet: 'Import from Sheet',
      syncNow: 'Sync to Cloud',
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      refresh: 'Refresh',
      close: 'Close',
      confirm: 'Confirm',
      shareWhatsApp: 'Share on WhatsApp',
      downloadReceipt: 'Download Receipt',
    },
    table: {
      row: '#',
      id: 'Customer ID',
      name: 'Customer Name',
      phone: 'Mobile Number',
      village: 'Village Name',
      disbursed: 'Given Amount',
      disbursedDate: 'Given Date',
      status: 'Status',
      paid: 'Total Paid',
      balance: 'Remaining Due',
      weeks: 'Weeks',
      week: 'Week',
      actions: 'Actions',
      villageTotal: 'Village Subtotal',
      grandTotal: 'Grand Total',
      noCustomersFound: 'No customers found matching your search.',
      enterVillageName: 'Enter Village / Group Name...',
      enterCustomerName: 'Customer Name...',
      enterPhone: '10-digit Mobile Number...',
    },
    status: {
      active: 'Active',
      paidOff: 'Paid Off',
      archived: 'Archived',
      pending: 'Pending',
      overdue: 'Overdue',
    },
    modals: {
      newCustomerTitle: 'Add New Customer',
      editCustomerTitle: 'Edit Customer Details',
      deleteTitle: 'Delete Customer Confirmation',
      deleteWarning: 'Are you sure you want to delete {name}? This cannot be undone.',
      importTitle: 'Import Data from Google Sheets',
      selectVillage: 'Select Village',
      loanAmount: 'Loan Amount (₹)',
      disbursalDate: 'Disbursal Date',
    },
    whatsapp: {
      paymentReminder: 'Namaste {name} garu, reminder from FinRoute: Your weekly installment of ₹{amount} is due. Remaining loan balance: ₹{balance}. Thank you!',
      paymentReceipt: 'Namaste {name} garu, thank you! Received payment of ₹{amount} towards your loan on {date}. Remaining loan balance: ₹{balance}. - FinRoute',
      leadInquiry: 'Hello, I am interested in FinRoute Collector for microfinance loan tracking.',
    },
    messages: {
      savedOffline: 'Saved {field} locally (Offline mode)',
      syncSuccess: 'Synced successfully with cloud',
      syncFailed: 'Sync failed: {error}',
      syncing: 'Syncing changes...',
      customerAdded: 'Customer {name} added successfully!',
      customerDeleted: 'Customer deleted successfully.',
      invalidPhone: 'Please enter a valid 10-digit mobile number.',
      networkOnline: 'Internet restored. Online mode active.',
      networkOffline: 'No internet connection. Working in offline mode.',
    },
  },

  te: {
    app: {
      title: 'ఫిన్‌రూట్',
      tagline: 'మైక్రోఫైనాన్స్ మరియు వారపు కలెక్షన్ ట్రాకర్',
      collector: 'ఫిన్‌రూట్ కలెక్టర్',
    },
    nav: {
      tracker: 'వారపు ట్రాకర్',
      archive: 'ముగిసిన లోన్లు',
      settings: 'సెట్టింగులు',
      superAdmin: 'సూపర్ అడ్మిన్',
      logout: 'లాగౌట్',
      tenant: 'బ్రాంచ్ / టెనెంట్',
    },
    kpis: {
      originalAmount: 'అసలు మొత్తం',
      totalDisbursed: 'మొత్తం ఇచ్చిన రుణం',
      totalPayable: 'మొత్తం చెల్లించవలసినది',
      totalCollected: 'మొత్తం వసూలు అయినది',
      totalOutstanding: 'మిగిలిన బకాయి',
      balanceDue: 'మిగిలిన బకాయి',
      netCash: 'చేతిలో ఉన్న నగదు',
      weeklyTarget: 'వారపు వసూలు లక్ష్యం',
      activeLoans: 'యాక్టివ్ లోన్లు',
      paidOffLoans: 'పూర్తయిన లోన్లు',
      collectionRate: 'రికవరీ శాతం',
    },
    toolbar: {
      searchPlaceholder: 'కస్టమర్ పేరు (తెలుగు / Eng), ఫోన్, ఐడీ తో వెతకండి...',
      allStatuses: 'అన్ని రకాలు',
      activeOnly: 'యాక్టివ్ లోన్లు మాత్రమే',
      paidOffOnly: 'పూర్తయినవి మాత్రమే',
      filterVillage: 'గ్రామం ప్రకారం ఫిల్టర్',
      allVillages: 'అన్ని గ్రామాలు',
    },
    actions: {
      addCustomer: 'కస్టమర్‌ని చేర్చండి',
      addVillage: 'కొత్త గ్రామ వరుస',
      addWeek: 'వారం చేర్చండి',
      deleteWeek: 'వారం తొలగించు',
      archiveRenew: 'ఆర్కైవ్ & పునరుద్ధరణ',
      exportPdf: 'PDF డౌన్‌లోడ్',
      exportCsv: 'CSV డౌన్‌లోడ్',
      importSheet: 'షీట్ నుండి ఇంపోర్ట్',
      syncNow: 'క్లౌడ్‌కి సింక్ చేయండి',
      save: 'భద్రపరచు',
      cancel: 'రద్దు చేయండి',
      delete: 'తొలగించు',
      edit: 'సవరించు',
      refresh: 'తాజాకరించు',
      close: 'మూసివేయి',
      confirm: 'నిర్ధారించండి',
      shareWhatsApp: 'వాట్సాప్‌లో పంపండి',
      downloadReceipt: 'రసీదు డౌన్‌లోడ్',
    },
    table: {
      row: '#',
      id: 'కస్టమర్ ఐడీ',
      name: 'కస్టమర్ పేరు',
      phone: 'ఫోన్ నంబర్',
      village: 'గ్రామం పేరు',
      disbursed: 'ఇచ్చిన మొత్తం',
      disbursedDate: 'ఇచ్చిన తేదీ',
      status: 'స్థితి',
      paid: 'చెల్లించినది',
      balance: 'మిగిలిన బకాయి',
      weeks: 'వారాలు',
      week: 'వారం',
      actions: 'చర్యలు',
      villageTotal: 'గ్రామ ఉప-మొత్తం',
      grandTotal: 'మొత్తం టోటల్',
      noCustomersFound: 'మీరు వెతికిన వివరాలు కనుగొనబడలేదు.',
      enterVillageName: 'గ్రామం లేదా గ్రూప్ పేరు నమోదు చేయండి...',
      enterCustomerName: 'కస్టమర్ పేరు నమోదు చేయండి...',
      enterPhone: '10 అంకెల మొబైల్ నంబర్...',
    },
    status: {
      active: 'యాక్టివ్',
      paidOff: 'పూర్తయింది',
      archived: 'ఆర్కైవ్ చేయబడింది',
      pending: 'పెండింగ్',
      overdue: 'బకాయి పడింది',
    },
    modals: {
      newCustomerTitle: 'కొత్త కస్టమర్‌ను చేర్చండి',
      editCustomerTitle: 'కస్టమర్ వివరాలను సవరించండి',
      deleteTitle: 'కస్టమర్‌ను తొలగించే నిర్ధారణ',
      deleteWarning: '{name} గారి రికార్డును ఖచ్చితంగా తొలగించాలనుకుంటున్నారా? దీన్ని తిరిగి పొందలేరు.',
      importTitle: 'గూగుల్ షీట్స్ నుండి డేటా ఇంపోర్ట్',
      selectVillage: 'గ్రామాన్ని ఎంచుకోండి',
      loanAmount: 'రుణం మొత్తం (₹)',
      disbursalDate: 'ఇచ్చిన తేదీ',
    },
    whatsapp: {
      paymentReminder: 'నమస్కారం {name} గారు, FinRoute నుండి రిమైండర్: మీ వారం లోన్ వాయిదా మొత్తం ₹{amount} చెల్లించవలసి ఉంది. మిగిలిన మొత్తం బకాయి: ₹{balance}. ధన్యవాదాలు!',
      paymentReceipt: 'నమస్కారం {name} గారు, ధన్యవాదాలు! మీ లోన్ ఖాతాకు ₹{amount} మొత్తం {date} న జమ అయింది. మిగిలిన మొత్తం బకాయి: ₹{balance}. - FinRoute',
      leadInquiry: 'నమస్కారం, నేను FinRoute కలెక్టర్ మైక్రోఫైనాన్స్ యాప్ గురించి తెలుసుకోవాలనుకుంటున్నాను.',
    },
    messages: {
      savedOffline: '{field} స్థానికంగా భద్రపరచబడింది (ఆఫ్‌లైన్ మోడ్)',
      syncSuccess: 'క్లౌడ్‌తో విజయవంతంగా సింక్ చేయబడింది',
      syncFailed: 'సింక్ విఫలమైంది: {error}',
      syncing: 'సింక్ అవుతోంది...',
      customerAdded: 'కస్టమర్ {name} విజయవంతంగా జోడించబడ్డారు!',
      customerDeleted: 'కస్టమర్ విజయవంతంగా తొలగించబడ్డారు.',
      invalidPhone: 'దయచేసి సరైన 10 అంకెల మొబైల్ నంబర్‌ను నమోదు చేయండి.',
      networkOnline: 'ఇంటర్నెట్ కనెక్ట్ అయింది. ఆన్‌లైన్ మోడ్ సక్రియం.',
      networkOffline: 'ఇంటర్నెట్ కనెక్షన్ లేదు. ఆఫ్‌లైన్ మోడ్‌లో పనిచేస్తోంది.',
    },
  },
};

const STORAGE_KEY = 'finroute_preferred_language';

/**
 * Get the currently selected language code from localStorage or browser default
 * @returns {'en' | 'te'}
 */
export function getSavedLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && (saved === 'en' || saved === 'te')) {
      return saved;
    }
  } catch (err) {
    console.warn('Could not read saved language preference:', err);
  }
  return 'en';
}

/**
 * Persist the selected language code to localStorage
 * @param {'en' | 'te'} lang 
 */
export function setSavedLanguage(lang) {
  try {
    if (lang === 'en' || lang === 'te') {
      localStorage.setItem(STORAGE_KEY, lang);
    }
  } catch (err) {
    console.warn('Could not save language preference:', err);
  }
}

/**
 * Translate a key into the target language with optional parameter interpolation
 * Usage:
 *   t('nav.tracker', 'te') => 'వారపు ట్రాకర్'
 *   t('whatsapp.paymentReminder', 'te', { name: 'రాము', amount: '500', balance: '2000' })
 *
 * @param {string} path - Dot-notated key (e.g. 'table.name', 'kpis.totalCollected')
 * @param {'en' | 'te'} [lang='en'] - Language code (defaults to English)
 * @param {Record<string, any>} [params] - Optional interpolation values
 * @returns {string} Translated string or English fallback, or path if not found
 */
export function t(path, lang = 'en', params = {}) {
  const targetLang = lang === 'te' ? 'te' : 'en';

  // Helper to traverse object by dot path
  const resolve = (obj, p) => {
    if (!obj || !p) return undefined;
    return p.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);
  };

  // Try target language, fallback to English
  let text = resolve(translations[targetLang], path);
  if (text === undefined && targetLang !== 'en') {
    text = resolve(translations.en, path);
  }

  if (text === undefined) {
    return path; // Fallback to key itself if translation is missing
  }

  // Parameter interpolation: replace {paramName}
  if (params && typeof params === 'object') {
    Object.keys(params).forEach((key) => {
      text = String(text).replace(new RegExp(`\\{${key}\\}`, 'g'), params[key] ?? '');
    });
  }

  return text;
}
