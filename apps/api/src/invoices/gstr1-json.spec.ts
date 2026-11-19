import {
  generateGstr1Json,
  buildGstr1Summary,
  generateGstr1Csv,
  formatGstDate,
  getPosCode,
  Gstr1Invoice,
  Gstr1Org,
} from './gstr1-json';

describe('GSTR-1 Official JSON & CSV Generator', () => {
  const mockOrg: Gstr1Org = {
    name: 'Radha Kishan Trading Co',
    gstNumber: '08AAAAA0000A1Z5',
    state: 'Rajasthan',
  };

  const mockInvoices: Gstr1Invoice[] = [
    // B2B Invoice 1 (Intra-state Rajasthan)
    {
      id: 'inv-1',
      invoiceNumber: 'INV-2026-001',
      invoiceDate: '2026-04-10T10:00:00.000Z',
      status: 'PAID',
      taxableAmount: 10000,
      cgstAmount: 900,
      sgstAmount: 900,
      igstAmount: 0,
      totalAmount: 11800,
      reverseCharge: false,
      customer: {
        name: 'Sharma Hardware & Paints',
        gstNumber: '08BBBBB1111B1Z2',
        state: 'Rajasthan',
      },
      items: [
        {
          quantity: 20,
          unit: 'BAG',
          price: 500,
          taxableAmt: 10000,
          gstRate: 18,
          cgstAmount: 900,
          sgstAmount: 900,
          igstAmount: 0,
          totalAmount: 11800,
          hsnCode: '6810',
          product: { name: 'Roff Tile Adhesive 20kg', hsnCode: '6810' },
        },
      ],
    },
    // B2B Invoice 2 (Inter-state Delhi)
    {
      id: 'inv-2',
      invoiceNumber: 'INV-2026-002',
      invoiceDate: '2026-04-15T12:00:00.000Z',
      status: 'SENT',
      taxableAmount: 5000,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 900,
      totalAmount: 5900,
      reverseCharge: false,
      customer: {
        name: 'Delhi Building Supplies',
        gstNumber: '07CCCCC2222C1Z3',
        state: 'Delhi',
      },
      items: [
        {
          quantity: 10,
          unit: 'KG',
          price: 500,
          taxableAmt: 5000,
          gstRate: 18,
          cgstAmount: 0,
          sgstAmount: 0,
          igstAmount: 900,
          totalAmount: 5900,
          hsnCode: '3214',
          product: { name: 'Roff Epoxy Grout 1kg', hsnCode: '3214' },
        },
      ],
    },
    // B2CS Invoice 3 (Unregistered Kirana Retailer)
    {
      id: 'inv-3',
      invoiceNumber: 'INV-2026-003',
      invoiceDate: '2026-04-20T14:00:00.000Z',
      status: 'PAID',
      taxableAmount: 2000,
      cgstAmount: 180,
      sgstAmount: 180,
      igstAmount: 0,
      totalAmount: 2360,
      reverseCharge: false,
      customer: {
        name: 'Local Unregistered Retailer',
        gstNumber: null,
        state: 'Rajasthan',
      },
      items: [
        {
          quantity: 4,
          unit: 'BAG',
          price: 500,
          taxableAmt: 2000,
          gstRate: 18,
          cgstAmount: 180,
          sgstAmount: 180,
          igstAmount: 0,
          totalAmount: 2360,
          hsnCode: '6810',
          product: { name: 'Roff Tile Adhesive 20kg', hsnCode: '6810' },
        },
      ],
    },
    // CANCELLED Invoice (Should appear only in doc_issue cancelled count)
    {
      id: 'inv-4',
      invoiceNumber: 'INV-2026-004',
      invoiceDate: '2026-04-22T14:00:00.000Z',
      status: 'CANCELLED',
      taxableAmount: 1000,
      cgstAmount: 90,
      sgstAmount: 90,
      igstAmount: 0,
      totalAmount: 1180,
      reverseCharge: false,
      customer: {
        name: 'Mistake Customer',
        gstNumber: null,
        state: 'Rajasthan',
      },
      items: [],
    },
  ];

  it('correctly formats GST dates as DD-MM-YYYY', () => {
    expect(formatGstDate('2026-04-10T10:00:00.000Z')).toBe('10-04-2026');
    expect(formatGstDate('2026-12-25')).toBe('25-12-2026');
  });

  it('correctly detects Place of Supply state codes', () => {
    expect(getPosCode('08BBBBB1111B1Z2')).toBe('08');
    expect(getPosCode('07CCCCC2222C1Z3')).toBe('07');
    expect(getPosCode(null, 'Maharashtra')).toBe('27');
    expect(getPosCode(null, 'Delhi')).toBe('07');
  });

  it('generates valid GSTR-1 JSON with B2B, B2CS, HSN, and doc_issue', () => {
    const json = generateGstr1Json(mockOrg, mockInvoices, '042026');

    expect(json.gstin).toBe('08AAAAA0000A1Z5');
    expect(json.fp).toBe('042026');
    expect(json.version).toBe('GST3.0.4');

    // B2B Section
    const b2b = json.b2b as Array<{ ctin: string; inv: Array<{ inum: string; pos: string; val: number; itms: unknown[] }> }>;
    expect(b2b.length).toBe(2);

    const sharma = b2b.find((b) => b.ctin === '08BBBBB1111B1Z2');
    expect(sharma).toBeDefined();
    expect(sharma?.inv[0].inum).toBe('INV-2026-001');
    expect(sharma?.inv[0].pos).toBe('08');
    expect(sharma?.inv[0].val).toBe(11800);

    const delhi = b2b.find((b) => b.ctin === '07CCCCC2222C1Z3');
    expect(delhi).toBeDefined();
    expect(delhi?.inv[0].inum).toBe('INV-2026-002');
    expect(delhi?.inv[0].pos).toBe('07');
    expect(delhi?.inv[0].val).toBe(5900);

    // B2CS Section (only inv-3)
    const b2cs = json.b2cs as Array<{ sply_ty: string; pos: string; txval: number; rt: number }>;
    expect(b2cs.length).toBe(1);
    expect(b2cs[0].sply_ty).toBe('INTRA');
    expect(b2cs[0].pos).toBe('08');
    expect(b2cs[0].txval).toBe(2000);
    expect(b2cs[0].rt).toBe(18);

    // HSN Section
    const hsn = json.hsn as { data: Array<{ hsn_sc: string; qty: number; txval: number }> };
    expect(hsn.data.length).toBe(2); // 6810 and 3214
    const hsn6810 = hsn.data.find((h) => h.hsn_sc === '6810');
    expect(hsn6810?.qty).toBe(24); // 20 from inv-1 + 4 from inv-3
    expect(hsn6810?.txval).toBe(12000); // 10000 + 2000

    // Doc Issue Section
    const doc = json.doc_issue as { doc_det: Array<{ docs: Array<{ totnum: number; canc: number; net_issue: number }> }> };
    expect(doc.doc_det[0].docs[0].totnum).toBe(4);
    expect(doc.doc_det[0].docs[0].canc).toBe(1);
    expect(doc.doc_det[0].docs[0].net_issue).toBe(3);
  });

  it('builds accurate summary and metrics', () => {
    const summary = buildGstr1Summary(mockOrg, mockInvoices, '042026');

    expect(summary.summary.totalInvoices).toBe(3); // 3 active
    expect(summary.summary.totalTaxable).toBe(17000); // 10000 + 5000 + 2000
    expect(summary.summary.b2bCount).toBe(2);
    expect(summary.summary.b2bTaxable).toBe(15000);
    expect(summary.summary.b2csTaxable).toBe(2000);
  });

  it('generates well-formatted CSV with all GSTR-1 tables', () => {
    const summary = buildGstr1Summary(mockOrg, mockInvoices, '042026');
    const csv = generateGstr1Csv(summary);

    expect(csv).toContain('GSTR-1 Outward Supplies Summary');
    expect(csv).toContain('08AAAAA0000A1Z5');
    expect(csv).toContain('TABLE 4A: B2B INVOICES');
    expect(csv).toContain('TABLE 7: B2CS (SMALL / UNREGISTERED)');
    expect(csv).toContain('TABLE 12: HSN-WISE SUMMARY OF OUTWARD SUPPLIES');
    expect(csv).toContain('INV-2026-001');
    expect(csv).toContain('08BBBBB1111B1Z2');
    expect(csv).toContain('6810');
  });
});
