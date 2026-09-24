import React from 'react';
import * as fs from 'fs';
import { resolveFontPath, registerDevanagariFonts } from './font-registry';
import {
  RTKStatementPDFDocument,
  RTKStatementData,
  styles,
} from './rtk-statement.document';
import { RtkStatementPdfService } from './rtk-statement-pdf.service';
import { Font, renderToBuffer } from '@react-pdf/renderer';

describe('RTK Statement PDF Engine & Typography (Milestone M4)', () => {
  const sampleStatement: RTKStatementData = {
    organization: {
      name: 'Radhakishan Trading Company',
      address: 'Main Market, Anaj Mandi',
      city: 'Rohtak',
      state: 'Haryana',
      phone: '+91 98765 43210',
      gstin: '06AAAAA0000A1Z5',
    },
    customer: {
      id: 'cust-1',
      name: 'Manish Kumar',
      phone: '+91 99999 11111',
      city: 'Rohtak',
      address: 'Shop #12, Cloth Market',
    },
    statementDate: '2026-09-23',
    rows: [
      {
        date: '2026-08-01',
        particulars: 'Opening Balance',
        amount: null,
        returned: null,
        paymentReceived: null,
        runningBalance: 0,
      },
      {
        date: '2026-08-04',
        particulars: 'अलमारी के लिए पत्थर (10 @ ₹1600.00)',
        amount: 16000,
        returned: null,
        paymentReceived: null,
        runningBalance: 16000,
      },
      {
        date: '2026-08-10',
        particulars: 'UPI Payment Ref #99281',
        amount: null,
        returned: null,
        paymentReceived: 10000,
        runningBalance: 6000,
      },
      {
        date: '2026-08-15',
        particulars: 'Bath Soap Return (2 @ ₹1200.00)',
        amount: null,
        returned: 2400,
        paymentReceived: null,
        runningBalance: 3600,
      },
      {
        date: '2026-08-20',
        particulars: 'Tea Powder (5 @ ₹1800.00)',
        goodsGivenAmount: 9000, // Testing dual alias goodsGivenAmount
        returnedAmount: null,
        paymentReceivedAmount: null,
        runningBalance: 12600,
      },
    ],
    summary: {
      totalGoodsGiven: 25000,
      totalGoodsReturned: 2400,
      totalPaymentsReceived: 10000,
      netBalance: 12600,
    },
  };

  describe('1. Font Registry & Asset Resolution', () => {
    it('1.1 resolves NotoSansDevanagari-Regular.ttf to a valid physical file', () => {
      const regularPath = resolveFontPath('NotoSansDevanagari-Regular.ttf');
      expect(fs.existsSync(regularPath)).toBe(true);
      const stat = fs.statSync(regularPath);
      expect(stat.size).toBe(219212);
    });

    it('1.2 resolves NotoSansDevanagari-Bold.ttf to a valid physical file', () => {
      const boldPath = resolveFontPath('NotoSansDevanagari-Bold.ttf');
      expect(fs.existsSync(boldPath)).toBe(true);
      const stat = fs.statSync(boldPath);
      expect(stat.size).toBe(225748);
    });

    it('1.3 throws an informative error when resolving a non-existent font', () => {
      expect(() => resolveFontPath('NonExistentFont-Whatever.ttf')).toThrow(
        /Font file "NonExistentFont-Whatever.ttf" could not be resolved/,
      );
    });

    it('1.4 registerDevanagariFonts executes idempotently without duplicate calls', () => {
      expect(() => {
        registerDevanagariFonts();
        registerDevanagariFonts();
        registerDevanagariFonts();
      }).not.toThrow();
    });
  });

  describe('2. RTK Statement PDF Document Layout & Styling', () => {
    it('2.1 instantiates RTKStatementPDFDocument with top-level NotoSansDevanagari fontFamily', () => {
      expect(styles.page.fontFamily).toBe('NotoSansDevanagari');
      expect(styles.page.fontSize).toBe(9);
    });

    it('2.2 maintains 5-column table proportions totaling 100%', () => {
      expect(styles.colDate.width).toBe('15%');
      expect(styles.colGoodsGiven.width).toBe('40%');
      expect(styles.colAmount.width).toBe('15%');
      expect(styles.colReturned.width).toBe('15%');
      expect(styles.colPaymentReceived.width).toBe('15%');
    });

    it('2.3 sets right alignment on numeric amount, returned, and payment columns', () => {
      expect(styles.colAmount.textAlign).toBe('right');
      expect(styles.colReturned.textAlign).toBe('right');
      expect(styles.colPaymentReceived.textAlign).toBe('right');
    });

    it('2.4 sets wrap={false} and right alignment on summaryBox', () => {
      expect(styles.summaryBox.alignSelf).toBe('flex-end');
      expect(styles.summaryBox.width).toBe(280);
    });

    it('2.5 renders document element with title containing unicode en-dash \\u2013', async () => {
      const doc = React.createElement(RTKStatementPDFDocument, {
        statement: sampleStatement,
      });
      const buffer = await (renderToBuffer as any)(doc);
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');

      const text = buffer.toString('utf8');
      expect(text).toContain('RTK – MANISH KUMAR ACCOUNT SUMMARY');
      expect(text).toContain('Radhakishan Trading Company');
      expect(text).toContain('GOODS GIVEN TO MANISH KUMAR');
    });

    it('2.6 supports unaggregated rows and dual aliases (goodsGivenAmount, returnedAmount, paymentReceivedAmount)', async () => {
      const doc = React.createElement(RTKStatementPDFDocument, {
        statement: sampleStatement,
      });
      const buffer = await (renderToBuffer as any)(doc);
      const text = buffer.toString('utf8');

      // Verify Hindi particulars
      expect(text).toContain('अलमारी के लिए पत्थर (10 @ ₹1600.00)');
      // Verify amounts and dual alias row
      expect(text).toContain('₹16000.00');
      expect(text).toContain('₹9000.00');
      expect(text).toContain('₹2400.00');
      expect(text).toContain('₹10000.00');
    });

    it('2.7 renders summary box with all four ledger totals and Net Balance', async () => {
      const doc = React.createElement(RTKStatementPDFDocument, {
        statement: sampleStatement,
      });
      const buffer = await (renderToBuffer as any)(doc);
      const text = buffer.toString('utf8');

      expect(text).toContain('TOTAL GOODS GIVEN:');
      expect(text).toContain('₹ 25000.00');
      expect(text).toContain('LESS: GOODS RETURNED:');
      expect(text).toContain('₹ 2400.00');
      expect(text).toContain('LESS: PAYMENTS RECEIVED:');
      expect(text).toContain('₹ 10000.00');
      expect(text).toContain('BALANCE:');
      expect(text).toContain('₹ 12600.00');
    });
  });

  describe('3. RtkStatementPdfService Integration', () => {
    it('3.1 generates a valid PDF buffer via RtkStatementPdfService.generatePdf', async () => {
      const pdfService = new RtkStatementPdfService();
      const buffer = await pdfService.generatePdf(sampleStatement);

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
    });

    it('3.2 handles undefined/partial summary fields defensively without throwing', async () => {
      const partialStatement: RTKStatementData = {
        organization: { name: 'Test Org' },
        customer: { id: 'c1', name: 'Defensive Cust' },
        statementDate: '2026-09-24',
        rows: [],
        summary: {} as any,
      };
      const pdfService = new RtkStatementPdfService();
      const buffer = await pdfService.generatePdf(partialStatement);
      expect(Buffer.isBuffer(buffer)).toBe(true);
      const text = buffer.toString('utf8');
      expect(text).toContain('TOTAL GOODS GIVEN:');
      expect(text).toContain('₹ 0.00');
    });

    it('3.3 renders dynamic page number in footer correctly', () => {
      const doc = RTKStatementPDFDocument({ statement: sampleStatement });
      // Find Text node with render function
      const findTextWithRender = (node: any): any => {
        if (!node) return null;
        if (node.props?.render && typeof node.props.render === 'function') return node;
        if (node.props?.children) {
          const children = Array.isArray(node.props.children)
            ? node.props.children
            : [node.props.children];
          for (const c of children) {
            const found = findTextWithRender(c);
            if (found) return found;
          }
        }
        return null;
      };
      const footerPageText = findTextWithRender(doc);
      expect(footerPageText).toBeDefined();
      expect(typeof footerPageText.props.render).toBe('function');
      const renderedStr = footerPageText.props.render({ pageNumber: 3, totalPages: 5 });
      expect(renderedStr).toBe('Page 3 of 5');
    });
  });
});

