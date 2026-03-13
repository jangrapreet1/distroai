/**
 * Tally XML generators for Sales Voucher and Receipt Voucher.
 * Generates valid Tally Prime XML for import.
 */

interface InvoiceForTally {
  invoiceNumber: string;
  invoiceDate: Date | string;
  netAmount: number;
  taxAmount: number;
  totalAmount: number;
  customer: { name: string; gstin?: string | null };
  org: { name: string };
  items: Array<{
    product: { name: string; hsnCode?: string | null };
    quantity: number;
    price: number;
    totalAmount: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    gstRate: number;
  }>;
}

interface PaymentForTally {
  paymentNumber?: string | null;
  paymentDate: Date | string;
  amount: number;
  paymentMethod: string;
  customer: { name: string };
  org: { name: string };
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(d: Date | string): string {
  const date = new Date(d);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${yyyy}${mm}${dd}`;
}

export function invoiceToTallyXML(invoice: InvoiceForTally): string {
  const ledgerEntries = invoice.items.map((item) => `
    <ALLINVENTORYENTRIES.LIST>
      <STOCKITEMNAME>${escapeXml(item.product.name)}</STOCKITEMNAME>
      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
      <RATE>${item.price}/nos</RATE>
      <AMOUNT>-${item.totalAmount}</AMOUNT>
      <ACTUALQTY>${item.quantity} nos</ACTUALQTY>
      <BILLEDQTY>${item.quantity} nos</BILLEDQTY>
    </ALLINVENTORYENTRIES.LIST>`).join('');

  const cgstTotal = invoice.items.reduce((s, i) => s + Number(i.cgstAmount), 0);
  const sgstTotal = invoice.items.reduce((s, i) => s + Number(i.sgstAmount), 0);
  const igstTotal = invoice.items.reduce((s, i) => s + Number(i.igstAmount), 0);

  let taxEntries = '';
  if (igstTotal > 0) {
    taxEntries = `
    <LEDGERENTRIES.LIST>
      <LEDGERNAME>IGST</LEDGERNAME>
      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
      <AMOUNT>-${igstTotal}</AMOUNT>
    </LEDGERENTRIES.LIST>`;
  } else {
    taxEntries = `
    <LEDGERENTRIES.LIST>
      <LEDGERNAME>CGST</LEDGERNAME>
      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
      <AMOUNT>-${cgstTotal}</AMOUNT>
    </LEDGERENTRIES.LIST>
    <LEDGERENTRIES.LIST>
      <LEDGERNAME>SGST</LEDGERNAME>
      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
      <AMOUNT>-${sgstTotal}</AMOUNT>
    </LEDGERENTRIES.LIST>`;
  }

  return `<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME><STATICVARIABLES><SVCURRENTCOMPANY>${escapeXml(invoice.org.name)}</SVCURRENTCOMPANY></STATICVARIABLES></REQUESTDESC>
  <REQUESTDATA><TALLYMESSAGE xmlns:UDF="TallyUDF">
    <VOUCHER VCHTYPE="Sales" ACTION="Create">
      <DATE>${formatDate(invoice.invoiceDate)}</DATE>
      <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
      <VOUCHERNUMBER>${escapeXml(invoice.invoiceNumber)}</VOUCHERNUMBER>
      <PARTYLEDGERNAME>${escapeXml(invoice.customer.name)}</PARTYLEDGERNAME>
      <PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>
      <ISINVOICE>Yes</ISINVOICE>
      <LEDGERENTRIES.LIST>
        <LEDGERNAME>${escapeXml(invoice.customer.name)}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <AMOUNT>${Number(invoice.netAmount)}</AMOUNT>
      </LEDGERENTRIES.LIST>
      <LEDGERENTRIES.LIST>
        <LEDGERNAME>Sales Account</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>-${Number(invoice.totalAmount)}</AMOUNT>
      </LEDGERENTRIES.LIST>
      ${taxEntries}
      ${ledgerEntries}
    </VOUCHER>
  </TALLYMESSAGE></REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`;
}

export function paymentToTallyXML(payment: PaymentForTally): string {
  const bankLedger = payment.paymentMethod === 'CASH' ? 'Cash' : 'Bank Account';

  return `<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME><STATICVARIABLES><SVCURRENTCOMPANY>${escapeXml(payment.org.name)}</SVCURRENTCOMPANY></STATICVARIABLES></REQUESTDESC>
  <REQUESTDATA><TALLYMESSAGE xmlns:UDF="TallyUDF">
    <VOUCHER VCHTYPE="Receipt" ACTION="Create">
      <DATE>${formatDate(payment.paymentDate)}</DATE>
      <VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>
      <VOUCHERNUMBER>${escapeXml(payment.paymentNumber ?? '')}</VOUCHERNUMBER>
      <PARTYLEDGERNAME>${escapeXml(payment.customer.name)}</PARTYLEDGERNAME>
      <LEDGERENTRIES.LIST>
        <LEDGERNAME>${bankLedger}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <AMOUNT>-${Number(payment.amount)}</AMOUNT>
      </LEDGERENTRIES.LIST>
      <LEDGERENTRIES.LIST>
        <LEDGERNAME>${escapeXml(payment.customer.name)}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>${Number(payment.amount)}</AMOUNT>
      </LEDGERENTRIES.LIST>
    </VOUCHER>
  </TALLYMESSAGE></REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`;
}
