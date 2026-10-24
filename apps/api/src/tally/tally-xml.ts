/**
 * Tally XML & CSV generators for Tally Prime / Tally.ERP 9.
 * Generates standard compliant Tally XML for:
 * - Masters (Customers / Sundry Debtors, Stock Items, Tax Ledgers)
 * - Sales Vouchers (Invoices with inventory details, GST, HSN)
 * - Receipt Vouchers (Payments received via Cash/Bank)
 * - Combined Vouchers Envelope
 * - CSV Daybook export for spreadsheets
 */

export interface InvoiceForTally {
  id?: string;
  invoiceNumber: string;
  invoiceDate: Date | string;
  netAmount: number;
  taxableAmount?: number;
  taxAmount: number;
  totalAmount: number;
  customer: {
    name: string;
    gstin?: string | null;
    state?: string | null;
    city?: string | null;
    pincode?: string | null;
    address?: string | null;
  };
  org: {
    name: string;
    gstin?: string | null;
    state?: string | null;
  };
  items: Array<{
    product: {
      name: string;
      hsnCode?: string | null;
      unit?: string | null;
    };
    variantName?: string | null;
    quantity: number;
    unit?: string | null;
    price: number;
    taxableAmt?: number;
    totalAmount: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    gstRate: number;
  }>;
}

export interface PaymentForTally {
  id?: string;
  paymentNumber?: string | null;
  paymentDate: Date | string;
  amount: number;
  paymentMethod: string;
  referenceNumber?: string | null;
  customer: {
    name: string;
    gstin?: string | null;
  };
  org: {
    name: string;
  };
}

export interface CustomerForTally {
  id: string;
  name: string;
  gstin?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
}

export interface StockItemForTally {
  id: string;
  name: string;
  hsnCode?: string | null;
  unit?: string | null;
  sellingPrice?: number | null;
  gstRate?: number | null;
}

export function escapeXml(s: string | null | undefined): string {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function formatDate(d: Date | string): string {
  const date = new Date(d);
  if (isNaN(date.getTime())) {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  }
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${yyyy}${mm}${dd}`;
}

export function formatDisplayDate(d: Date | string): string {
  const date = new Date(d);
  if (isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
}

// ─── Single Voucher (Legacy backward compatibility) ─────────────

export function invoiceToTallyXML(invoice: InvoiceForTally): string {
  const singleVoucherMessage = buildSingleSalesVoucherMessage(invoice);
  return `<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME><STATICVARIABLES><SVCURRENTCOMPANY>${escapeXml(invoice.org.name)}</SVCURRENTCOMPANY></STATICVARIABLES></REQUESTDESC>
  <REQUESTDATA>
    ${singleVoucherMessage}
  </REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`;
}

export function paymentToTallyXML(payment: PaymentForTally): string {
  const singleReceiptMessage = buildSingleReceiptVoucherMessage(payment);
  return `<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME><STATICVARIABLES><SVCURRENTCOMPANY>${escapeXml(payment.org.name)}</SVCURRENTCOMPANY></STATICVARIABLES></REQUESTDESC>
  <REQUESTDATA>
    ${singleReceiptMessage}
  </REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`;
}

// ─── Voucher Message Builders ───────────────────────────────────

function buildSingleSalesVoucherMessage(invoice: InvoiceForTally): string {
  const ledgerEntries = invoice.items.map((item) => {
    const itemName = item.variantName
      ? `${item.product.name} - ${item.variantName}`
      : item.product.name;
    const unitStr = item.unit || item.product.unit || 'nos';
    return `
      <ALLINVENTORYENTRIES.LIST>
        <STOCKITEMNAME>${escapeXml(itemName)}</STOCKITEMNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <RATE>${item.price}/${escapeXml(unitStr)}</RATE>
        <AMOUNT>-${item.totalAmount}</AMOUNT>
        <ACTUALQTY>${item.quantity} ${escapeXml(unitStr)}</ACTUALQTY>
        <BILLEDQTY>${item.quantity} ${escapeXml(unitStr)}</BILLEDQTY>
      </ALLINVENTORYENTRIES.LIST>`;
  }).join('');

  const cgstTotal = invoice.items.reduce((s, i) => s + Number(i.cgstAmount || 0), 0);
  const sgstTotal = invoice.items.reduce((s, i) => s + Number(i.sgstAmount || 0), 0);
  const igstTotal = invoice.items.reduce((s, i) => s + Number(i.igstAmount || 0), 0);
  const taxableTotal = invoice.taxableAmount !== undefined ? Number(invoice.taxableAmount) : invoice.items.reduce((s, i) => s + Number(i.taxableAmt || (i.totalAmount - (i.cgstAmount + i.sgstAmount + i.igstAmount))), 0);

  let taxEntries = '';
  if (igstTotal > 0) {
    taxEntries = `
      <LEDGERENTRIES.LIST>
        <LEDGERNAME>IGST</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>-${igstTotal.toFixed(2)}</AMOUNT>
      </LEDGERENTRIES.LIST>`;
  } else {
    taxEntries = `
      <LEDGERENTRIES.LIST>
        <LEDGERNAME>CGST</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>-${cgstTotal.toFixed(2)}</AMOUNT>
      </LEDGERENTRIES.LIST>
      <LEDGERENTRIES.LIST>
        <LEDGERNAME>SGST</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>-${sgstTotal.toFixed(2)}</AMOUNT>
      </LEDGERENTRIES.LIST>`;
  }

  const partyGstinXml = invoice.customer.gstin ? `<PARTYGSTIN>${escapeXml(invoice.customer.gstin)}</PARTYGSTIN>` : '';
  const partyStateXml = invoice.customer.state ? `<STATENAME>${escapeXml(invoice.customer.state)}</STATENAME>` : '';

  return `<TALLYMESSAGE xmlns:UDF="TallyUDF">
    <VOUCHER VCHTYPE="Sales" ACTION="Create">
      <DATE>${formatDate(invoice.invoiceDate)}</DATE>
      <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
      <VOUCHERNUMBER>${escapeXml(invoice.invoiceNumber)}</VOUCHERNUMBER>
      <PARTYLEDGERNAME>${escapeXml(invoice.customer.name)}</PARTYLEDGERNAME>
      ${partyGstinXml}
      ${partyStateXml}
      <PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>
      <ISINVOICE>Yes</ISINVOICE>
      <LEDGERENTRIES.LIST>
        <LEDGERNAME>${escapeXml(invoice.customer.name)}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <AMOUNT>${Number(invoice.netAmount || invoice.totalAmount).toFixed(2)}</AMOUNT>
      </LEDGERENTRIES.LIST>
      <LEDGERENTRIES.LIST>
        <LEDGERNAME>Sales Account</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>-${taxableTotal.toFixed(2)}</AMOUNT>
      </LEDGERENTRIES.LIST>
      ${taxEntries}
      ${ledgerEntries}
    </VOUCHER>
  </TALLYMESSAGE>`;
}

function buildSingleReceiptVoucherMessage(payment: PaymentForTally): string {
  const bankLedger = payment.paymentMethod === 'CASH' ? 'Cash' : 'Bank Account';
  const vchNum = payment.paymentNumber || payment.referenceNumber || `RCP-${formatDate(payment.paymentDate)}`;

  return `<TALLYMESSAGE xmlns:UDF="TallyUDF">
    <VOUCHER VCHTYPE="Receipt" ACTION="Create">
      <DATE>${formatDate(payment.paymentDate)}</DATE>
      <VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>
      <VOUCHERNUMBER>${escapeXml(vchNum)}</VOUCHERNUMBER>
      <PARTYLEDGERNAME>${escapeXml(payment.customer.name)}</PARTYLEDGERNAME>
      ${payment.referenceNumber ? `<NARRATION>Ref: ${escapeXml(payment.referenceNumber)}</NARRATION>` : ''}
      <LEDGERENTRIES.LIST>
        <LEDGERNAME>${bankLedger}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <AMOUNT>-${Number(payment.amount).toFixed(2)}</AMOUNT>
      </LEDGERENTRIES.LIST>
      <LEDGERENTRIES.LIST>
        <LEDGERNAME>${escapeXml(payment.customer.name)}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>${Number(payment.amount).toFixed(2)}</AMOUNT>
      </LEDGERENTRIES.LIST>
    </VOUCHER>
  </TALLYMESSAGE>`;
}

// ─── Multi-Voucher Envelopes ────────────────────────────────────

export function buildSalesVouchersEnvelope(companyName: string, invoices: InvoiceForTally[]): string {
  const messages = invoices.map(inv => buildSingleSalesVoucherMessage(inv)).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
${messages}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

export function buildReceiptVouchersEnvelope(companyName: string, payments: PaymentForTally[]): string {
  const messages = payments.map(pay => buildSingleReceiptVoucherMessage(pay)).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
${messages}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

export function buildCombinedVouchersEnvelope(
  companyName: string,
  invoices: InvoiceForTally[],
  payments: PaymentForTally[]
): string {
  const salesMessages = invoices.map(inv => buildSingleSalesVoucherMessage(inv)).join('\n');
  const receiptMessages = payments.map(pay => buildSingleReceiptVoucherMessage(pay)).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
${salesMessages}
${receiptMessages}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

// ─── Masters Envelope (Ledgers + Stock Items) ───────────────────

export function buildMastersEnvelope(
  companyName: string,
  customers: CustomerForTally[],
  stockItems: StockItemForTally[]
): string {
  // Standard Ledgers (Sales, CGST, SGST, IGST, Cash, Bank)
  const standardLedgers = `
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
      <LEDGER NAME="Sales Account" ACTION="Create">
        <NAME>Sales Account</NAME>
        <PARENT>Sales Accounts</PARENT>
        <ISBILLWISEON>No</ISBILLWISEON>
        <AFFECTSSTOCK>Yes</AFFECTSSTOCK>
      </LEDGER>
    </TALLYMESSAGE>
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
      <LEDGER NAME="CGST" ACTION="Create">
        <NAME>CGST</NAME>
        <PARENT>Duties &amp; Taxes</PARENT>
        <TAXTYPE>GST</TAXTYPE>
        <GSTDUTYHEAD>Central Tax</GSTDUTYHEAD>
      </LEDGER>
    </TALLYMESSAGE>
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
      <LEDGER NAME="SGST" ACTION="Create">
        <NAME>SGST</NAME>
        <PARENT>Duties &amp; Taxes</PARENT>
        <TAXTYPE>GST</TAXTYPE>
        <GSTDUTYHEAD>State Tax</GSTDUTYHEAD>
      </LEDGER>
    </TALLYMESSAGE>
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
      <LEDGER NAME="IGST" ACTION="Create">
        <NAME>IGST</NAME>
        <PARENT>Duties &amp; Taxes</PARENT>
        <TAXTYPE>GST</TAXTYPE>
        <GSTDUTYHEAD>Integrated Tax</GSTDUTYHEAD>
      </LEDGER>
    </TALLYMESSAGE>
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
      <LEDGER NAME="Bank Account" ACTION="Create">
        <NAME>Bank Account</NAME>
        <PARENT>Bank Accounts</PARENT>
      </LEDGER>
    </TALLYMESSAGE>`;

  // Customer Ledgers under Sundry Debtors
  const customerLedgers = customers.map(c => `
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
      <LEDGER NAME="${escapeXml(c.name)}" ACTION="Create">
        <NAME>${escapeXml(c.name)}</NAME>
        <PARENT>Sundry Debtors</PARENT>
        <ISBILLWISEON>Yes</ISBILLWISEON>
        ${c.gstin ? `<PARTYGSTIN>${escapeXml(c.gstin)}</PARTYGSTIN>` : ''}
        ${c.gstin ? `<GSTREGISTRATIONTYPE>Regular</GSTREGISTRATIONTYPE>` : `<GSTREGISTRATIONTYPE>Unregistered</GSTREGISTRATIONTYPE>`}
        ${c.state ? `<LEDSTATENAME>${escapeXml(c.state)}</LEDSTATENAME>` : ''}
        ${c.pincode ? `<PINCODE>${escapeXml(c.pincode)}</PINCODE>` : ''}
        ${c.address ? `<ADDRESS.LIST><ADDRESS>${escapeXml(c.address)}</ADDRESS></ADDRESS.LIST>` : ''}
        <COUNTRYNAME>India</COUNTRYNAME>
      </LEDGER>
    </TALLYMESSAGE>`).join('\n');

  // Stock Items
  const itemsXml = stockItems.map(item => `
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
      <STOCKITEM NAME="${escapeXml(item.name)}" ACTION="Create">
        <NAME>${escapeXml(item.name)}</NAME>
        <PARENT>Primary</PARENT>
        <BASEUNITS>${escapeXml(item.unit || 'NOS')}</BASEUNITS>
        <GSTAPPLICABLE>&#4; Applicable</GSTAPPLICABLE>
        <GSTTYPEOFSUPPLY>Goods</GSTTYPEOFSUPPLY>
        ${item.hsnCode ? `<HSNCODE>${escapeXml(item.hsnCode)}</HSNCODE>` : ''}
      </STOCKITEM>
    </TALLYMESSAGE>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
${standardLedgers}
${customerLedgers}
${itemsXml}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

// ─── CSV Export for Spreadsheet Review ──────────────────────────

export function buildSalesCSV(invoices: InvoiceForTally[]): string {
  const headers = [
    'Invoice Number',
    'Date',
    'Customer Name',
    'Customer GSTIN',
    'Item Name',
    'HSN Code',
    'Quantity',
    'Unit',
    'Rate',
    'Taxable Amount',
    'GST Rate (%)',
    'CGST Amount',
    'SGST Amount',
    'IGST Amount',
    'Total Amount'
  ];

  const rows: string[] = [headers.join(',')];

  for (const inv of invoices) {
    for (const item of inv.items) {
      const itemName = item.variantName
        ? `${item.product.name} - ${item.variantName}`
        : item.product.name;
      const unit = item.unit || item.product.unit || 'nos';
      const taxable = item.taxableAmt || (item.totalAmount - (item.cgstAmount + item.sgstAmount + item.igstAmount));
      
      rows.push([
        escapeCsv(inv.invoiceNumber),
        escapeCsv(formatDisplayDate(inv.invoiceDate)),
        escapeCsv(inv.customer.name),
        escapeCsv(inv.customer.gstin || ''),
        escapeCsv(itemName),
        escapeCsv(item.product.hsnCode || ''),
        item.quantity.toString(),
        escapeCsv(unit),
        item.price.toFixed(2),
        taxable.toFixed(2),
        item.gstRate.toString(),
        item.cgstAmount.toFixed(2),
        item.sgstAmount.toFixed(2),
        item.igstAmount.toFixed(2),
        item.totalAmount.toFixed(2)
      ].join(','));
    }
  }

  return rows.join('\r\n');
}

export function buildReceiptsCSV(payments: PaymentForTally[]): string {
  const headers = [
    'Receipt Number',
    'Date',
    'Customer Name',
    'Payment Method',
    'Reference Number',
    'Amount'
  ];

  const rows: string[] = [headers.join(',')];

  for (const pay of payments) {
    const vchNum = pay.paymentNumber || pay.referenceNumber || '';
    rows.push([
      escapeCsv(vchNum),
      escapeCsv(formatDisplayDate(pay.paymentDate)),
      escapeCsv(pay.customer.name),
      escapeCsv(pay.paymentMethod),
      escapeCsv(pay.referenceNumber || ''),
      pay.amount.toFixed(2)
    ].join(','));
  }

  return rows.join('\r\n');
}

function escapeCsv(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}
