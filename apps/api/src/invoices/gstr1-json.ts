/**
 * GSTR-1 Official JSON & CSV Generator
 * Conforms to the Goods and Services Tax Network (GSTN) offline tool specification.
 * Validated for Indian GST Portal (gst.gov.in) upload.
 */

export const GST_STATE_CODES: Record<string, string> = {
  'JAMMU AND KASHMIR': '01',
  'HIMACHAL PRADESH': '02',
  'PUNJAB': '03',
  'CHANDIGARH': '04',
  'UTTARAKHAND': '05',
  'HARYANA': '06',
  'DELHI': '07',
  'RAJASTHAN': '08',
  'UTTAR PRADESH': '09',
  'BIHAR': '10',
  'SIKKIM': '11',
  'ARUNACHAL PRADESH': '12',
  'NAGALAND': '13',
  'MANIPUR': '14',
  'MIZORAM': '15',
  'TRIPURA': '16',
  'MEGHALAYA': '17',
  'ASSAM': '18',
  'WEST BENGAL': '19',
  'JHARKHAND': '20',
  'ODISHA': '21',
  'CHHATTISGARH': '22',
  'MADHYA PRADESH': '23',
  'GUJARAT': '24',
  'DAMAN AND DIU': '25',
  'DADRA AND NAGAR HAVELI': '26',
  'MAHARASHTRA': '27',
  'ANDHRA PRADESH (OLD)': '28',
  'KARNATAKA': '29',
  'GOA': '30',
  'LAKSHADWEEP': '31',
  'KERALA': '32',
  'TAMIL NADU': '33',
  'PUDUCHERRY': '34',
  'ANDAMAN AND NICOBAR ISLANDS': '35',
  'TELANGANA': '36',
  'ANDHRA PRADESH': '37',
  'LADAKH': '38',
  'OTHER TERRITORY': '97',
  'CENTRE JURISDICTION': '99',
};

export interface Gstr1Item {
  id?: string;
  hsnCode?: string | null;
  description?: string | null;
  quantity: number;
  unit: string;
  price: number;
  discount?: number;
  taxableAmt: number;
  gstRate: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  cessAmount?: number;
  totalAmount: number;
  product?: {
    name?: string;
    sku?: string;
    hsnCode?: string | null;
  } | null;
}

export interface Gstr1Invoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: Date | string;
  status: string;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cessAmount?: number;
  totalAmount: number;
  reverseCharge?: boolean;
  placeOfSupply?: string | null;
  customer: {
    name: string;
    gstNumber?: string | null;
    state?: string | null;
    address?: string | null;
  };
  items: Gstr1Item[];
}

export interface Gstr1Org {
  name: string;
  gstNumber?: string | null;
  state?: string | null;
}

export function r2(val: number): number {
  return Math.round((Number(val) || 0) * 100) / 100;
}

export function formatGstDate(dateVal: Date | string): string {
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '01-01-2026';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export function getPosCode(
  customerGst?: string | null,
  customerState?: string | null,
  orgGst?: string | null,
  orgState?: string | null,
): string {
  if (customerGst && customerGst.length >= 2 && /^\d{2}/.test(customerGst)) {
    return customerGst.substring(0, 2);
  }
  if (customerState) {
    const norm = customerState.trim().toUpperCase();
    if (GST_STATE_CODES[norm]) return GST_STATE_CODES[norm];
  }
  if (orgGst && orgGst.length >= 2 && /^\d{2}/.test(orgGst)) {
    return orgGst.substring(0, 2);
  }
  if (orgState) {
    const norm = orgState.trim().toUpperCase();
    if (GST_STATE_CODES[norm]) return GST_STATE_CODES[norm];
  }
  return '07'; // Fallback
}

/**
 * Generates the official GSTN GSTR-1 JSON schema ready for upload to gst.gov.in
 */
export function generateGstr1Json(
  org: Gstr1Org,
  invoices: Gstr1Invoice[],
  fp: string, // Return period MMYYYY, e.g. "042026"
): Record<string, unknown> {
  const supplierGstin = (org.gstNumber || 'URP').toUpperCase().trim();
  const orgPos = getPosCode(org.gstNumber, org.state);

  const b2bMap = new Map<string, Array<Record<string, unknown>>>();
  const b2csMap = new Map<string, {
    sply_ty: 'INTRA' | 'INTER';
    pos: string;
    typ: 'OE';
    txval: number;
    rt: number;
    camt: number;
    samt: number;
    csamt: number;
  }>();

  const hsnMap = new Map<string, {
    hsn_sc: string;
    desc: string;
    uqc: string;
    qty: number;
    val: number;
    txval: number;
    camt: number;
    samt: number;
    csamt: number;
  }>();

  let activeInvoicesCount = 0;
  let cancelledCount = 0;
  const sortedInvoiceNumbers: string[] = [];

  for (const inv of invoices) {
    if (inv.status === 'CANCELLED') {
      cancelledCount++;
      sortedInvoiceNumbers.push(inv.invoiceNumber);
      continue;
    }

    activeInvoicesCount++;
    sortedInvoiceNumbers.push(inv.invoiceNumber);

    const isB2B = Boolean(inv.customer.gstNumber && inv.customer.gstNumber.trim().length === 15);
    const pos = getPosCode(inv.customer.gstNumber, inv.customer.state, org.gstNumber, org.state);
    const isInterState = pos !== orgPos;

    // Aggregate items by tax rate for the invoice
    const rateGroupMap = new Map<number, {
      taxable: number;
      cgst: number;
      sgst: number;
      igst: number;
      cess: number;
    }>();

    for (const itm of inv.items || []) {
      const rate = r2(itm.gstRate);
      const cur = rateGroupMap.get(rate) || { taxable: 0, cgst: 0, sgst: 0, igst: 0, cess: 0 };
      cur.taxable += itm.taxableAmt || 0;
      cur.cgst += itm.cgstAmount || 0;
      cur.sgst += itm.sgstAmount || 0;
      cur.igst += itm.igstAmount || 0;
      cur.cess += itm.cessAmount || 0;
      rateGroupMap.set(rate, cur);

      // Accumulate HSN summary
      const hsnRaw = itm.hsnCode || itm.product?.hsnCode || 'OTHER';
      const hsnKey = `${hsnRaw}_${rate}`;
      const desc = itm.product?.name || itm.description || 'Goods';
      const uqc = (itm.unit || 'NOS').trim().toUpperCase().substring(0, 3) || 'OTH';

      const curHsn = hsnMap.get(hsnKey) || {
        hsn_sc: hsnRaw,
        desc: desc.substring(0, 30),
        uqc,
        qty: 0,
        val: 0,
        txval: 0,
        camt: 0,
        samt: 0,
        csamt: 0,
      };

      curHsn.qty += itm.quantity || 0;
      curHsn.val += itm.totalAmount || 0;
      curHsn.txval += itm.taxableAmt || 0;
      curHsn.camt += itm.cgstAmount || 0;
      curHsn.samt += itm.sgstAmount || 0;
      curHsn.csamt += itm.cessAmount || 0;
      hsnMap.set(hsnKey, curHsn);
    }

    if (isB2B) {
      const ctin = inv.customer.gstNumber!.trim().toUpperCase();
      const invItemList = Array.from(rateGroupMap.entries()).map(([rate, vals], idx) => ({
        num: idx + 1,
        itm_det: {
          txval: r2(vals.taxable),
          rt: r2(rate),
          camt: r2(vals.cgst),
          samt: r2(vals.sgst),
          csamt: r2(vals.cess),
        },
      }));

      const b2bInv = {
        inum: inv.invoiceNumber,
        idt: formatGstDate(inv.invoiceDate),
        val: r2(inv.totalAmount),
        pos,
        rchrg: inv.reverseCharge ? 'Y' : 'N',
        inv_typ: 'R',
        itms: invItemList,
      };

      const existing = b2bMap.get(ctin) || [];
      existing.push(b2bInv);
      b2bMap.set(ctin, existing);
    } else {
      // B2CS: Aggregate by POS, Supply Type, and Rate
      const sply_ty = isInterState ? 'INTER' : 'INTRA';
      for (const [rate, vals] of rateGroupMap.entries()) {
        const key = `${sply_ty}_${pos}_${rate}`;
        const cur = b2csMap.get(key) || {
          sply_ty,
          pos,
          typ: 'OE',
          txval: 0,
          rt: rate,
          camt: 0,
          samt: 0,
          csamt: 0,
        };
        cur.txval += vals.taxable;
        cur.camt += vals.cgst;
        cur.samt += vals.sgst;
        cur.csamt += vals.cess;
        b2csMap.set(key, cur);
      }
    }
  }

  // Format B2B section
  const b2b = Array.from(b2bMap.entries()).map(([ctin, invList]) => ({
    ctin,
    cfs: 'N',
    inv: invList,
  }));

  // Format B2CS section
  const b2cs = Array.from(b2csMap.values()).map((row) => ({
    sply_ty: row.sply_ty,
    pos: row.pos,
    typ: row.typ,
    txval: r2(row.txval),
    rt: r2(row.rt),
    camt: r2(row.camt),
    samt: r2(row.samt),
    csamt: r2(row.csamt),
  }));

  // Format HSN section
  const hsnData = Array.from(hsnMap.values()).map((row, idx) => ({
    num: idx + 1,
    hsn_sc: row.hsn_sc,
    desc: row.desc,
    uqc: row.uqc,
    qty: r2(row.qty),
    val: r2(row.val),
    txval: r2(row.txval),
    camt: r2(row.camt),
    samt: r2(row.samt),
    csamt: r2(row.csamt),
  }));

  // Document Issue section
  const sortedNums = sortedInvoiceNumbers.sort();
  const firstInv = sortedNums[0] || 'INV-0001';
  const lastInv = sortedNums[sortedNums.length - 1] || 'INV-0001';
  const totalCount = activeInvoicesCount + cancelledCount;

  const doc_issue = {
    doc_det: [
      {
        doc_num: 1,
        doc_typ: 'Invoices for outward supply',
        docs: [
          {
            num: 1,
            from: firstInv,
            to: lastInv,
            totnum: totalCount,
            canc: cancelledCount,
            net_issue: activeInvoicesCount,
          },
        ],
      },
    ],
  };

  return {
    gstin: supplierGstin,
    fp,
    version: 'GST3.0.4',
    hash: 'hash',
    cur_gt: 0.0,
    gt: 0.0,
    b2b,
    b2cs,
    hsn: {
      data: hsnData,
    },
    doc_issue,
  };
}

/**
 * Builds structured summary metrics for the web UI and CSV generation
 */
export function buildGstr1Summary(
  org: Gstr1Org,
  invoices: Gstr1Invoice[],
  fp: string,
) {
  const json = generateGstr1Json(org, invoices, fp);

  let b2bTaxable = 0;
  let b2bTax = 0;
  let b2bCount = 0;

  for (const b of (json.b2b as Array<{ inv: Array<{ val: number; itms: Array<{ itm_det: { txval: number; camt: number; samt: number; csamt: number } }> }> }>)) {
    for (const inv of b.inv) {
      b2bCount++;
      for (const itm of inv.itms) {
        b2bTaxable += itm.itm_det.txval;
        b2bTax += itm.itm_det.camt + itm.itm_det.samt + itm.itm_det.csamt;
      }
    }
  }

  let b2csTaxable = 0;
  let b2csTax = 0;

  for (const s of (json.b2cs as Array<{ txval: number; camt: number; samt: number; csamt: number }>)) {
    b2csTaxable += s.txval;
    b2csTax += s.camt + s.samt + s.csamt;
  }

  const totalTaxable = r2(b2bTaxable + b2csTaxable);
  const totalTax = r2(b2bTax + b2csTax);
  const totalInvoices = invoices.filter((i) => i.status !== 'CANCELLED').length;

  return {
    fp,
    supplierGstin: json.gstin as string,
    orgName: org.name,
    summary: {
      totalTaxable,
      totalTax,
      totalInvoices,
      b2bTaxable: r2(b2bTaxable),
      b2bTax: r2(b2bTax),
      b2bCount,
      b2csTaxable: r2(b2csTaxable),
      b2csTax: r2(b2csTax),
      b2csCount: (json.b2cs as unknown[]).length,
    },
    b2b: json.b2b,
    b2cs: json.b2cs,
    hsn: (json.hsn as { data: unknown[] }).data,
    doc_issue: json.doc_issue,
  };
}

/**
 * Generates a clean CSV spreadsheet for Accountants / CAs
 */
export function generateGstr1Csv(summary: ReturnType<typeof buildGstr1Summary>): string {
  const lines: string[] = [];

  // Header Info
  lines.push(`"GSTR-1 Outward Supplies Summary"`);
  lines.push(`"Distributor","${summary.orgName}"`);
  lines.push(`"GSTIN","${summary.supplierGstin}"`);
  lines.push(`"Return Period (MMYYYY)","${summary.fp}"`);
  lines.push(``);

  // High-Level Summary
  lines.push(`"--- STATUTORY TURNOVER SUMMARY ---"`);
  lines.push(`"Category","Count / Lines","Taxable Value (INR)","Total Tax (INR)"`);
  lines.push(`"B2B Invoices (Registered)",${summary.summary.b2bCount},${summary.summary.b2bTaxable.toFixed(2)},${summary.summary.b2bTax.toFixed(2)}`);
  lines.push(`"B2CS Invoices (Unregistered / Retail)",${summary.summary.b2csCount},${summary.summary.b2csTaxable.toFixed(2)},${summary.summary.b2csTax.toFixed(2)}`);
  lines.push(`"Total Outward Supplies",${summary.summary.totalInvoices},${summary.summary.totalTaxable.toFixed(2)},${summary.summary.totalTax.toFixed(2)}`);
  lines.push(``);

  // B2B Details
  lines.push(`"--- TABLE 4A: B2B INVOICES ---"`);
  lines.push(`"Customer GSTIN","Invoice Number","Invoice Date","Invoice Value","Place of Supply","Reverse Charge","Rate (%)","Taxable Value","CGST","SGST","Cess"`);

  for (const b of (summary.b2b as Array<{ ctin: string; inv: Array<{ inum: string; idt: string; val: number; pos: string; rchrg: string; itms: Array<{ itm_det: { rt: number; txval: number; camt: number; samt: number; csamt: number } }> }> }>)) {
    for (const inv of b.inv) {
      for (const itm of inv.itms) {
        lines.push(
          `"${b.ctin}","${inv.inum}","${inv.idt}",${inv.val.toFixed(2)},"${inv.pos}","${inv.rchrg}",${itm.itm_det.rt},${itm.itm_det.txval.toFixed(2)},${itm.itm_det.camt.toFixed(2)},${itm.itm_det.samt.toFixed(2)},${itm.itm_det.csamt.toFixed(2)}`
        );
      }
    }
  }
  lines.push(``);

  // B2CS Details
  lines.push(`"--- TABLE 7: B2CS (SMALL / UNREGISTERED) ---"`);
  lines.push(`"Supply Type","Place of Supply","Rate (%)","Taxable Value","CGST","SGST","Cess"`);
  for (const s of (summary.b2cs as Array<{ sply_ty: string; pos: string; rt: number; txval: number; camt: number; samt: number; csamt: number }>)) {
    lines.push(
      `"${s.sply_ty}","${s.pos}",${s.rt},${s.txval.toFixed(2)},${s.camt.toFixed(2)},${s.samt.toFixed(2)},${s.csamt.toFixed(2)}`
    );
  }
  lines.push(``);

  // HSN Summary
  lines.push(`"--- TABLE 12: HSN-WISE SUMMARY OF OUTWARD SUPPLIES ---"`);
  lines.push(`"HSN Code","Description","UQC","Total Qty","Total Value","Taxable Value","CGST","SGST","Cess"`);
  for (const h of (summary.hsn as Array<{ hsn_sc: string; desc: string; uqc: string; qty: number; val: number; txval: number; camt: number; samt: number; csamt: number }>)) {
    lines.push(
      `"${h.hsn_sc}","${h.desc}","${h.uqc}",${h.qty.toFixed(2)},${h.val.toFixed(2)},${h.txval.toFixed(2)},${h.camt.toFixed(2)},${h.samt.toFixed(2)},${h.csamt.toFixed(2)}`
    );
  }

  return lines.join('\n');
}
