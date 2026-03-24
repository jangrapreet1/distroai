export const LANGUAGES = [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
    { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
    { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
    { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
    { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
    { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી' },
    { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
];

type TranslationKeys =
    | 'dashboard' | 'orders' | 'invoices' | 'inventory' | 'customers' | 'suppliers'
    | 'analytics' | 'finance' | 'purchase_orders' | 'field_force' | 'routes' | 'visits'
    | 'ai_assistant' | 'settings' | 'new_order' | 'quick_action' | 'search'
    | 'revenue' | 'outstanding' | 'low_stock'
    | 'language_region' | 'select_language' | 'language_desc'
    | 'operations_title' | 'finance_title' | 'intelligence_title' | 'settings_title' | 'expenses'
    | 'general' | 'team' | 'gst_invoicing' | 'notifications' | 'language' | 'integrations' | 'billing';

const en: Record<TranslationKeys, string> = {
    dashboard: 'Dashboard', orders: 'Orders', invoices: 'Invoices', inventory: 'Inventory',
    customers: 'Customers', suppliers: 'Suppliers', analytics: 'Analytics', finance: 'Payments',
    purchase_orders: 'Purchase Orders', field_force: 'Field Force', routes: 'Routes', visits: 'Visits',
    ai_assistant: 'DistroAI', settings: 'Settings',
    new_order: 'New Order', quick_action: 'Quick Actions', search: 'Search...',
    revenue: 'Revenue', outstanding: 'Outstanding', low_stock: 'Low Stock',
    language_region: 'Language & Region', select_language: 'Select Language',
    language_desc: 'Choose your preferred language for the DistroAI dashboard.',
    operations_title: 'OPERATIONS', finance_title: 'FINANCE', intelligence_title: 'INTELLIGENCE', settings_title: 'SETTINGS',
    expenses: 'Expenses',
    general: 'General', team: 'Team', gst_invoicing: 'GST & Invoicing', notifications: 'Notifications',
    language: 'Language', integrations: 'Integrations', billing: 'Billing'
};

const hi: Record<TranslationKeys, string> = {
    dashboard: 'डैशबोर्ड', orders: 'ऑर्डर', invoices: 'चालान', inventory: 'इन्वेंटरी',
    customers: 'ग्राहक', suppliers: 'आपूर्तिकर्ता', analytics: 'एनालिटिक्स', finance: 'पेमेंट',
    purchase_orders: 'खरीद आदेश', field_force: 'फील्ड फोर्स', routes: 'रूट', visits: 'विज़िट',
    ai_assistant: 'डिस्ट्रो-एआई', settings: 'सेटिंग्स',
    new_order: 'नया ऑर्डर', quick_action: 'त्वरित कार्रवाई', search: 'खोजें...',
    revenue: 'राजस्व', outstanding: 'बकाया', low_stock: 'कम स्टॉक',
    language_region: 'भाषा और क्षेत्र', select_language: 'भाषा चुनें',
    language_desc: 'डिस्ट्रोAI डैशबोर्ड के लिए अपनी पसंदीदा भाषा चुनें।',
    operations_title: 'संचालन', finance_title: 'वित्त', intelligence_title: 'आर्टिफिशियल इंटेलिजेंस (AI)', settings_title: 'सेटिंग्स',
    expenses: 'खर्च',
    general: 'सामान्य', team: 'टीम', gst_invoicing: 'जीएसटी और चालान', notifications: 'सूचनाएं',
    language: 'भाषा', integrations: 'एकीकरण (Integrations)', billing: 'बिलिंग'
};

const mr: Record<TranslationKeys, string> = {
    dashboard: 'डॅशबोर्ड', orders: 'ऑर्डर्स', invoices: 'इन्व्हॉइस', inventory: 'इन्व्हेंटरी',
    customers: 'ग्राहक', suppliers: 'पुरवठादार', analytics: 'अॅनालिटिक्स', finance: 'पेमेंट्स',
    purchase_orders: 'खरेदी आदेश', field_force: 'फील्ड फोर्स', routes: 'मार्ग', visits: 'भेटी',
    ai_assistant: 'डिस्ट्रो-एआय', settings: 'सेटिंग्ज',
    new_order: 'नवीन ऑर्डर', quick_action: 'त्वरित कृती', search: 'शोधा...',
    revenue: 'महसूल', outstanding: 'थकीत', low_stock: 'कमी स्टॉक',
    language_region: 'भाषा आणि प्रदेश', select_language: 'भाषा निवडा',
    language_desc: 'डिस्ट्रोAI डॅशबोर्डसाठी तुमची आवडती भाषा निवडा.',
    operations_title: 'ऑपरेशन्स', finance_title: 'फायनान्स', intelligence_title: 'इंटेलिजन्स', settings_title: 'सेटिंग्ज',
    expenses: 'खर्च',
    general: 'सामान्य', team: 'टीम', gst_invoicing: 'जीएसटी आणि इन्व्हॉइसिंग', notifications: 'सूचना',
    language: 'भाषा', integrations: 'इंटीग्रेशन्स', billing: 'बिलिंग'
};

const ta: Record<TranslationKeys, string> = {
    dashboard: 'முகப்பு', orders: 'ஆர்டர்கள்', invoices: 'விலைப்பட்டியல்', inventory: 'சரக்கு',
    customers: 'வாடிக்கையாளர்கள்', suppliers: 'சப்ளையர்கள்', analytics: 'பகுப்பாய்வு', finance: 'பணப்பரிமாற்றம்',
    purchase_orders: 'கொள்முதல் ஆர்டர்கள்', field_force: 'களப்பணியாளர்கள்', routes: 'வழிகள்', visits: 'பார்வைகள்',
    ai_assistant: 'டிஸ்ட்ரோ-ஏஐ', settings: 'அமைப்புகள்',
    new_order: 'புதிய ஆர்டர்', quick_action: 'விரைவான செயல்', search: 'தேடு...',
    revenue: 'வருவாய்', outstanding: 'நிலுவையில் உள்ளவை', low_stock: 'குறைந்த சரக்கு',
    language_region: 'மொழி & பிராந்தியம்', select_language: 'மொழியைத் தேர்ந்தெடு',
    language_desc: 'உங்கள் விருப்பமான மொழியைத் தேர்ந்தெடுக்கவும்.',
    operations_title: 'செயல்பாடுகள்', finance_title: 'நிதி', intelligence_title: 'நுண்ணறிவு', settings_title: 'அமைப்புகள்',
    expenses: 'செலவுகள்',
    general: 'பொதுவாய்', team: 'குழு', gst_invoicing: 'ஜிஎஸ்டி & விலைப்பட்டியல்', notifications: 'அறிவிப்புகள்',
    language: 'மொழி', integrations: 'ஒருங்கிணைப்புகள்', billing: 'பில்லிங்'
};

// Fallbacks for missing languages (using English)
const fallback = en;
const te = fallback; const kn = fallback; const gu = fallback; const bn = fallback;

const dictionaries: Record<string, Record<TranslationKeys, string>> = { en, hi, mr, ta, te, kn, gu, bn };

export function getTranslation(lang: string, key: TranslationKeys): string {
    const dict = dictionaries[lang] || dictionaries.en;
    return dict[key] || dictionaries.en[key] || key;
}
