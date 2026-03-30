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

// ─── ALL TRANSLATION KEYS ───
// Organized by: sidebar → settings → dashboard → orders → inventory → customers → common
type TranslationKeys =
    // Sidebar & Navigation
    | 'dashboard' | 'orders' | 'invoices' | 'inventory' | 'customers' | 'suppliers'
    | 'analytics' | 'finance' | 'purchase_orders' | 'field_force' | 'routes' | 'visits'
    | 'ai_assistant' | 'settings' | 'new_order' | 'quick_action' | 'search'
    | 'operations_title' | 'finance_title' | 'intelligence_title' | 'settings_title' | 'expenses'
    // Settings tabs
    | 'general' | 'team' | 'gst_invoicing' | 'notifications' | 'language' | 'integrations' | 'billing'
    | 'language_region' | 'select_language' | 'language_desc'
    // Dashboard
    | 'revenue' | 'outstanding' | 'low_stock'
    | 'heres_your_day' | 'refresh' | 'orders_today_worth' | 'outstanding_collections' | 'revenue_this_month' | 'from_orders'
    | 'view_orders' | 'view_plan' | 'see_report'
    | 'vs_monthly_avg' | 'today' | 'total_due' | 'products_below_min'
    | 'sales_trend' | 'alerts' | 'now' | 'view' | 'collect'
    | 'products_below_reorder' | 'total_outstanding_from_customers' | 'no_alerts'
    | 'loading_sales' | 'no_sales_data'
    | 'portal_orders' | 'view_all' | 'no_portal_orders' | 'share_portal_link'
    | 'top_products' | 'top_customers' | 'no_product_data' | 'no_customer_data'
    // Orders
    | 'order_hash' | 'customer' | 'date' | 'amount' | 'source' | 'status' | 'actions'
    | 'search_by_customer_or_order' | 'no_orders_found' | 'create_first_order' | 'send_invoice'
    | 'orders_total' | 'all' | 'portal'
    | 'draft' | 'confirmed' | 'packed' | 'dispatched' | 'delivered' | 'cancelled' | 'returned'
    // Orders Detail
    | 'order_details' | 'edit_order' | 'save_changes' | 'cancel'
    | 'confirm_order' | 'mark_packed' | 'mark_dispatched' | 'mark_delivered' | 'cancel_order' | 'return_order'
    | 'product' | 'qty' | 'price' | 'gst' | 'total' | 'discount'
    | 'subtotal' | 'tax' | 'net_total'
    | 'order_confirmed' | 'order_packed' | 'order_dispatched' | 'order_delivered'
    | 'order_cancelled' | 'order_returned'
    // Inventory
    | 'add_product' | 'adjust' | 'transfer'
    | 'total_products' | 'total_value' | 'total_units'
    | 'products_tab' | 'transactions_tab' | 'low_stock_tab' | 'expiring_tab'
    | 'search_products' | 'product_name' | 'sku' | 'unit' | 'selling_price' | 'mrp' | 'purchase_price'
    | 'min_stock' | 'gst_rate' | 'initial_qty' | 'product_images' | 'reorder'
    | 'pieces' | 'boxes' | 'cartons' | 'kg'
    // Customers
    | 'add_customer' | 'import' | 'search_customers' | 'no_customers_found' | 'try_adjusting'
    | 'name' | 'city' | 'phone' | 'score' | 'whatsapp'
    | 'total_label' | 'active' | 'retailers' | 'wholesalers'
    | 'gold' | 'silver' | 'bronze' | 'high_risk' | 'dormant'
    // Common / Toast
    | 'order_created' | 'product_created' | 'product_updated' | 'customer_created' | 'payment_recorded'
    | 'stock_adjusted' | 'stock_transferred' | 'org_updated' | 'settings_updated'
    | 'loading' | 'saving' | 'save' | 'close' | 'back' | 'next' | 'previous'
    | 'csv_import_soon' | 'copied_link' | 'unknown';

const en: Record<TranslationKeys, string> = {
    // Sidebar & Navigation
    dashboard: 'Dashboard', orders: 'Orders', invoices: 'Invoices', inventory: 'Inventory',
    customers: 'Customers', suppliers: 'Suppliers', analytics: 'Analytics', finance: 'Payments',
    purchase_orders: 'Purchase Orders', field_force: 'Field Force', routes: 'Routes', visits: 'Visits',
    ai_assistant: 'DistroAI', settings: 'Settings',
    new_order: 'New Order', quick_action: 'Quick Actions', search: 'Search...',
    operations_title: 'OPERATIONS', finance_title: 'FINANCE', intelligence_title: 'INTELLIGENCE', settings_title: 'SETTINGS',
    expenses: 'Expenses',
    // Settings tabs
    general: 'General', team: 'Team', gst_invoicing: 'GST & Invoicing', notifications: 'Notifications',
    language: 'Language', integrations: 'Integrations', billing: 'Billing',
    language_region: 'Language & Region', select_language: 'Select Language',
    language_desc: 'Choose your preferred language for the DistroAI dashboard.',
    // Dashboard
    revenue: 'Revenue', outstanding: 'Outstanding', low_stock: 'Low Stock',
    heres_your_day: "Here's your day.", refresh: 'Refresh',
    orders_today_worth: 'orders today worth', outstanding_collections: 'outstanding collections',
    revenue_this_month: 'revenue this month', from_orders: 'orders',
    view_orders: 'View Orders', view_plan: 'View Plan', see_report: 'See Report',
    vs_monthly_avg: 'vs monthly avg', today: 'today', total_due: 'total due', products_below_min: 'products below min',
    sales_trend: 'Sales Trend', alerts: 'Alerts', now: 'Now', view: 'View', collect: 'Collect',
    products_below_reorder: 'products below reorder level',
    total_outstanding_from_customers: 'total outstanding from customers',
    no_alerts: 'No alerts right now. Everything looks good!',
    loading_sales: 'Loading sales data...', no_sales_data: 'No sales data for this period. Create orders to see trends.',
    portal_orders: 'Portal Orders', view_all: 'View All',
    no_portal_orders: 'No portal orders yet', share_portal_link: 'Share your portal link with retailers to start receiving orders online',
    top_products: 'Top Products', top_customers: 'Top Customers',
    no_product_data: 'No product data yet', no_customer_data: 'No customer data yet',
    // Orders
    order_hash: 'Order #', customer: 'Customer', date: 'Date', amount: 'Amount', source: 'Source', status: 'Status', actions: 'Actions',
    search_by_customer_or_order: 'Search by customer or order #', no_orders_found: 'No orders found',
    create_first_order: 'Create your first order →', send_invoice: 'Send Invoice',
    orders_total: 'orders total', all: 'All', portal: 'Portal',
    draft: 'Draft', confirmed: 'Confirmed', packed: 'Packed', dispatched: 'Dispatched', delivered: 'Delivered', cancelled: 'Cancelled', returned: 'Returned',
    // Orders Detail
    order_details: 'Order Details', edit_order: 'Edit Order', save_changes: 'Save Changes', cancel: 'Cancel',
    confirm_order: 'Confirm Order', mark_packed: 'Mark Packed', mark_dispatched: 'Dispatch', mark_delivered: 'Deliver', cancel_order: 'Cancel Order', return_order: 'Return Order',
    product: 'Product', qty: 'Qty', price: 'Price', gst: 'GST', total: 'Total', discount: 'Discount',
    subtotal: 'Subtotal', tax: 'Tax', net_total: 'Net Total',
    order_confirmed: 'Order Confirmed', order_packed: 'Order Packed', order_dispatched: 'Order Dispatched', order_delivered: 'Order Delivered',
    order_cancelled: 'Order Cancelled', order_returned: 'Order Returned',
    // Inventory
    add_product: 'Add Product', adjust: 'Adjust', transfer: 'Transfer',
    total_products: 'Total Products', total_value: 'Total Value', total_units: 'Total Units',
    products_tab: 'Products', transactions_tab: 'Transactions', low_stock_tab: 'Low Stock', expiring_tab: 'Expiring',
    search_products: 'Search products...', product_name: 'Product Name', sku: 'SKU', unit: 'Unit',
    selling_price: 'Selling Price', mrp: 'MRP', purchase_price: 'Purchase Price',
    min_stock: 'Min Stock', gst_rate: 'GST Rate', initial_qty: 'Initial Qty', product_images: 'Product Images', reorder: 'Reorder',
    pieces: 'Pieces', boxes: 'Boxes', cartons: 'Cartons', kg: 'Kg',
    // Customers
    add_customer: 'Add Customer', import: 'Import', search_customers: 'Search customers...', no_customers_found: 'No customers found',
    try_adjusting: 'Try adjusting your search or filters',
    name: 'Name', city: 'City', phone: 'Phone', score: 'Score', whatsapp: 'WhatsApp',
    total_label: 'Total', active: 'Active', retailers: 'Retailers', wholesalers: 'Wholesalers',
    gold: 'Gold', silver: 'Silver', bronze: 'Bronze', high_risk: 'High Risk', dormant: 'Dormant',
    // Common / Toast
    order_created: 'Order created', product_created: 'Product created', product_updated: 'Product updated',
    customer_created: 'Customer created', payment_recorded: 'Payment recorded',
    stock_adjusted: 'Stock adjusted', stock_transferred: 'Stock transferred',
    org_updated: 'Organization updated', settings_updated: 'Settings updated',
    loading: 'Loading...', saving: 'Saving...', save: 'Save', close: 'Close',
    back: 'Back', next: 'Next', previous: 'Previous',
    csv_import_soon: 'CSV import coming soon!', copied_link: 'Copied link', unknown: 'Unknown',
};

const hi: Record<TranslationKeys, string> = {
    // Sidebar & Navigation
    dashboard: 'डैशबोर्ड', orders: 'ऑर्डर', invoices: 'चालान', inventory: 'इन्वेंटरी',
    customers: 'ग्राहक', suppliers: 'आपूर्तिकर्ता', analytics: 'एनालिटिक्स', finance: 'पेमेंट',
    purchase_orders: 'खरीद आदेश', field_force: 'फील्ड फोर्स', routes: 'रूट', visits: 'विज़िट',
    ai_assistant: 'डिस्ट्रो-एआई', settings: 'सेटिंग्स',
    new_order: 'नया ऑर्डर', quick_action: 'त्वरित कार्रवाई', search: 'खोजें...',
    operations_title: 'संचालन', finance_title: 'वित्त', intelligence_title: 'आर्टिफिशियल इंटेलिजेंस (AI)', settings_title: 'सेटिंग्स',
    expenses: 'खर्च',
    // Settings tabs
    general: 'सामान्य', team: 'टीम', gst_invoicing: 'जीएसटी और चालान', notifications: 'सूचनाएं',
    language: 'भाषा', integrations: 'एकीकरण (Integrations)', billing: 'बिलिंग',
    language_region: 'भाषा और क्षेत्र', select_language: 'भाषा चुनें',
    language_desc: 'डिस्ट्रोAI डैशबोर्ड के लिए अपनी पसंदीदा भाषा चुनें।',
    // Dashboard
    revenue: 'राजस्व', outstanding: 'बकाया', low_stock: 'कम स्टॉक',
    heres_your_day: 'आज का सारांश।', refresh: 'रिफ्रेश',
    orders_today_worth: 'आज के ऑर्डर, कुल', outstanding_collections: 'बकाया वसूली',
    revenue_this_month: 'इस महीने की आय', from_orders: 'ऑर्डर',
    view_orders: 'ऑर्डर देखें', view_plan: 'योजना देखें', see_report: 'रिपोर्ट देखें',
    vs_monthly_avg: 'मासिक औसत बनाम', today: 'आज', total_due: 'कुल बकाया', products_below_min: 'न्यूनतम से कम',
    sales_trend: 'बिक्री रुझान', alerts: 'अलर्ट', now: 'अभी', view: 'देखें', collect: 'वसूलें',
    products_below_reorder: 'उत्पाद री-ऑर्डर स्तर से नीचे',
    total_outstanding_from_customers: 'ग्राहकों से कुल बकाया',
    no_alerts: 'कोई अलर्ट नहीं। सब कुछ ठीक है!',
    loading_sales: 'बिक्री डेटा लोड हो रहा है...', no_sales_data: 'इस अवधि के लिए कोई बिक्री डेटा नहीं। रुझान देखने के लिए ऑर्डर बनाएं।',
    portal_orders: 'पोर्टल ऑर्डर', view_all: 'सब देखें',
    no_portal_orders: 'अभी कोई पोर्टल ऑर्डर नहीं', share_portal_link: 'ऑनलाइन ऑर्डर प्राप्त करने के लिए अपना पोर्टल लिंक रिटेलर्स के साथ साझा करें',
    top_products: 'शीर्ष उत्पाद', top_customers: 'शीर्ष ग्राहक',
    no_product_data: 'अभी कोई उत्पाद डेटा नहीं', no_customer_data: 'अभी कोई ग्राहक डेटा नहीं',
    // Orders
    order_hash: 'ऑर्डर #', customer: 'ग्राहक', date: 'तारीख', amount: 'राशि', source: 'स्रोत', status: 'स्थिति', actions: 'कार्रवाई',
    search_by_customer_or_order: 'ग्राहक या ऑर्डर # से खोजें', no_orders_found: 'कोई ऑर्डर नहीं मिला',
    create_first_order: 'अपना पहला ऑर्डर बनाएं →', send_invoice: 'चालान भेजें',
    orders_total: 'कुल ऑर्डर', all: 'सभी', portal: 'पोर्टल',
    draft: 'ड्राफ्ट', confirmed: 'पुष्टि', packed: 'पैक', dispatched: 'भेजा गया', delivered: 'डिलीवर', cancelled: 'रद्द', returned: 'वापस',
    // Orders Detail
    order_details: 'ऑर्डर विवरण', edit_order: 'ऑर्डर संपादित करें', save_changes: 'बदलाव सहेजें', cancel: 'रद्द करें',
    confirm_order: 'ऑर्डर पुष्टि करें', mark_packed: 'पैक करें', mark_dispatched: 'भेजें', mark_delivered: 'डिलीवर करें', cancel_order: 'ऑर्डर रद्द करें', return_order: 'वापसी करें',
    product: 'उत्पाद', qty: 'मात्रा', price: 'कीमत', gst: 'जीएसटी', total: 'कुल', discount: 'छूट',
    subtotal: 'उप-कुल', tax: 'कर', net_total: 'शुद्ध कुल',
    order_confirmed: 'ऑर्डर पुष्टि हुई', order_packed: 'ऑर्डर पैक हुआ', order_dispatched: 'ऑर्डर भेजा गया', order_delivered: 'ऑर्डर डिलीवर हुआ',
    order_cancelled: 'ऑर्डर रद्द हुआ', order_returned: 'ऑर्डर वापस हुआ',
    // Inventory
    add_product: 'उत्पाद जोड़ें', adjust: 'समायोजन', transfer: 'ट्रांसफर',
    total_products: 'कुल उत्पाद', total_value: 'कुल मूल्य', total_units: 'कुल यूनिट',
    products_tab: 'उत्पाद', transactions_tab: 'लेन-देन', low_stock_tab: 'कम स्टॉक', expiring_tab: 'समाप्त हो रहा',
    search_products: 'उत्पाद खोजें...', product_name: 'उत्पाद का नाम', sku: 'एसकेयू', unit: 'यूनिट',
    selling_price: 'बिक्री मूल्य', mrp: 'एमआरपी', purchase_price: 'खरीद मूल्य',
    min_stock: 'न्यूनतम स्टॉक', gst_rate: 'जीएसटी दर', initial_qty: 'प्रारंभिक मात्रा', product_images: 'उत्पाद की तस्वीरें', reorder: 'री-ऑर्डर',
    pieces: 'पीस', boxes: 'बॉक्स', cartons: 'कार्टन', kg: 'किलो',
    // Customers
    add_customer: 'ग्राहक जोड़ें', import: 'आयात', search_customers: 'ग्राहक खोजें...', no_customers_found: 'कोई ग्राहक नहीं मिला',
    try_adjusting: 'अपनी खोज या फिल्टर बदलकर देखें',
    name: 'नाम', city: 'शहर', phone: 'फ़ोन', score: 'स्कोर', whatsapp: 'व्हाट्सएप',
    total_label: 'कुल', active: 'सक्रिय', retailers: 'रिटेलर', wholesalers: 'होलसेलर',
    gold: 'गोल्ड', silver: 'सिल्वर', bronze: 'ब्रॉन्ज़', high_risk: 'उच्च जोखिम', dormant: 'निष्क्रिय',
    // Common / Toast
    order_created: 'ऑर्डर बनाया गया', product_created: 'उत्पाद बनाया गया', product_updated: 'उत्पाद अपडेट हुआ',
    customer_created: 'ग्राहक जोड़ा गया', payment_recorded: 'भुगतान दर्ज हुआ',
    stock_adjusted: 'स्टॉक समायोजित हुआ', stock_transferred: 'स्टॉक ट्रांसफर हुआ',
    org_updated: 'संगठन अपडेट हुआ', settings_updated: 'सेटिंग्स अपडेट हुईं',
    loading: 'लोड हो रहा है...', saving: 'सहेज रहा है...', save: 'सहेजें', close: 'बंद करें',
    back: 'वापस', next: 'अगला', previous: 'पिछला',
    csv_import_soon: 'CSV आयात जल्द आ रहा है!', copied_link: 'लिंक कॉपी हो गया', unknown: 'अज्ञात',
};

const mr: Record<TranslationKeys, string> = {
    ...en, // Use English as base, override what we have
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
    language: 'भाषा', integrations: 'इंटीग्रेशन्स', billing: 'बिलिंग',
};

const ta: Record<TranslationKeys, string> = {
    ...en, // Use English as base, override what we have
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
    language: 'மொழி', integrations: 'ஒருங்கிணைப்புகள்', billing: 'பில்லிங்',
};

// Fallbacks for missing languages (using English base with spread)
const te: Record<TranslationKeys, string> = { ...en };
const kn: Record<TranslationKeys, string> = { ...en };
const gu: Record<TranslationKeys, string> = { ...en };
const bn: Record<TranslationKeys, string> = { ...en };

const dictionaries: Record<string, Record<TranslationKeys, string>> = { en, hi, mr, ta, te, kn, gu, bn };

export function getTranslation(lang: string, key: TranslationKeys): string {
    const dict = dictionaries[lang] || dictionaries.en;
    return dict[key] || dictionaries.en[key] || key;
}
