import React from 'react';
import { registerDevanagariFonts } from './font-registry';

// Helper to obtain ReactPDF in both CommonJS (tests/mock) and ESM runtime
export function getReactPdf(customReactPdf?: any) {
  if (customReactPdf) return customReactPdf;
  try {
    return require('@react-pdf/renderer');
  } catch {
    return null;
  }
}

/* ─── Domain Interface Contracts ─── */

export interface RTKStatementRowData {
  date: string;
  particulars: string;
  amount?: number | null;
  goodsGivenAmount?: number | null;
  returned?: number | null;
  returnedAmount?: number | null;
  paymentReceived?: number | null;
  paymentReceivedAmount?: number | null;
  runningBalance?: number;
  rawType?: string;
}

export interface RTKStatementSummaryData {
  totalGoodsGiven: number;
  totalGoodsReturned: number;
  totalPaymentsReceived: number;
  totalAdjustments?: number;
  netBalance: number;
  openingBalance?: number;
  closingBalance?: number;
  transactionCount?: number;
}

export interface RTKStatementData {
  organization: {
    name: string;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    phone?: string | null;
    gstin?: string | null;
  };
  customer: {
    id?: string;
    name: string;
    phone?: string | null;
    city?: string | null;
    address?: string | null;
  };
  statementDate: string;
  rows: RTKStatementRowData[];
  summary: RTKStatementSummaryData;
}

/* ─── Color Palette ─── */
const GOLD = '#C9A84C';
const DARK = '#1a1625';
const LIGHT_CREAM = '#f0e8d5';
const MUTED = '#555555';
const BORDER = '#dddddd';
const ALT_ROW = '#faf9f7';
const WHITE = '#ffffff';
const SUMMARY_BG = '#fdfaf0';

/* ─── Lazy Stylesheet Factory ─── */
let cachedStyles: any = null;
export function getStyles(StyleSheet: any) {
  if (cachedStyles) return cachedStyles;
  if (!StyleSheet || typeof StyleSheet.create !== 'function') {
    return {};
  }
  cachedStyles = StyleSheet.create({
    page: {
      padding: 24,
      fontSize: 9,
      fontFamily: 'NotoSansDevanagari',
      color: '#111111',
      backgroundColor: WHITE,
    },
    headerContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderBottom: `2pt solid ${GOLD}`,
      paddingBottom: 10,
      marginBottom: 12,
    },
    headerLeft: {
      flex: 1,
      paddingRight: 12,
    },
    headerRight: {
      textAlign: 'right',
      alignItems: 'flex-end',
    },
    orgName: {
      fontSize: 16,
      fontWeight: 'bold',
      color: DARK,
      marginBottom: 2,
    },
    orgDetail: {
      fontSize: 8,
      color: MUTED,
      marginTop: 1.5,
    },
    docTitle: {
      fontSize: 13,
      fontWeight: 'bold',
      color: DARK,
      textTransform: 'uppercase',
      marginBottom: 2,
    },
    customerDetail: {
      fontSize: 8.5,
      color: '#222222',
      marginTop: 1.5,
    },
    table: {
      width: '100%',
      marginBottom: 10,
    },
    tableHeader: {
      flexDirection: 'row',
      backgroundColor: DARK,
      paddingVertical: 5,
      borderTopLeftRadius: 3,
      borderTopRightRadius: 3,
    },
    thCell: {
      color: LIGHT_CREAM,
      fontWeight: 'bold',
      fontSize: 8,
      paddingHorizontal: 4,
      textTransform: 'uppercase',
    },
    tableRow: {
      flexDirection: 'row',
      borderBottom: `0.5pt solid ${BORDER}`,
      paddingVertical: 4,
      minHeight: 18,
      alignItems: 'flex-start',
    },
    tableRowAlt: {
      backgroundColor: ALT_ROW,
    },
    tdCell: {
      fontSize: 8.5,
      paddingHorizontal: 4,
      lineHeight: 1.3,
    },
    // 5 Distinct Column Widths (Sum = 100%)
    colDate: {
      width: '15%',
    },
    colGoodsGiven: {
      width: '40%',
    },
    colAmount: {
      width: '15%',
      textAlign: 'right',
    },
    colReturned: {
      width: '15%',
      textAlign: 'right',
    },
    colPaymentReceived: {
      width: '15%',
      textAlign: 'right',
    },
    // Summary Box
    summaryContainer: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: 10,
    },
    summaryBox: {
      width: 280,
      border: `1pt solid ${GOLD}`,
      borderRadius: 3,
      padding: 8,
      backgroundColor: SUMMARY_BG,
      alignSelf: 'flex-end',
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 2.5,
      fontSize: 8.5,
    },
    summaryLabel: {
      fontWeight: 'bold',
      color: '#333333',
    },
    summaryValue: {
      color: '#111111',
    },
    balanceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderTop: `1.5pt solid ${GOLD}`,
      paddingTop: 4,
      marginTop: 4,
      fontSize: 10.5,
      fontWeight: 'bold',
    },
    balanceLabel: {
      fontWeight: 'bold',
      color: DARK,
    },
    balanceValue: {
      fontWeight: 'bold',
      color: DARK,
    },
    // Footer
    footer: {
      marginTop: 16,
      borderTop: `0.5pt solid ${BORDER}`,
      paddingTop: 6,
      flexDirection: 'row',
      justifyContent: 'space-between',
      fontSize: 7.5,
      color: '#888888',
    },
  });
  return cachedStyles;
}

// Transparent styles Proxy for backward compatibility with tests
export const styles: any = new Proxy({}, {
  get(target, prop) {
    const ReactPDF = getReactPdf();
    if (ReactPDF?.StyleSheet) {
      const s = getStyles(ReactPDF.StyleSheet);
      return s[prop] || {};
    }
    return {};
  },
});

/* ─── Helper: Currency Cell Formatter ─── */
const formatCellAmount = (val: number | null | undefined): string => {
  if (val === null || val === undefined || isNaN(val)) {
    return '—';
  }
  return `₹${Number(val).toFixed(2)}`;
};

/* ─── RTK 5-Column Statement Document Component ─── */
export const RTKStatementPDFDocument: React.FC<{
  statement: RTKStatementData;
  fontFamily?: string;
  reactPdf?: any;
}> = ({ statement, fontFamily, reactPdf }) => {
  const ReactPDF = getReactPdf(reactPdf);
  if (!ReactPDF) {
    throw new Error('ReactPDF renderer is required to render RTKStatementPDFDocument');
  }

  const { Document, Page, Text, View, StyleSheet, Font } = ReactPDF;
  registerDevanagariFonts(Font);

  const currentStyles = getStyles(StyleSheet);

  const { organization, customer, statementDate, rows, summary } = statement;

  const pageStyle = fontFamily
    ? [currentStyles.page, { fontFamily }]
    : currentStyles.page;

  // Format header strings
  const orgLocation = [organization.city, organization.state]
    .filter(Boolean)
    .join(', ');
  const orgContact = [
    orgLocation,
    organization.phone ? `Phone: ${organization.phone}` : null,
  ]
    .filter(Boolean)
    .join(' | ');

  const customerUpper = (customer.name || 'CUSTOMER').toUpperCase();
  const docTitleText = `RTK \u2013 ${customerUpper} ACCOUNT SUMMARY`;
  const goodsGivenHeader = `GOODS GIVEN TO ${customerUpper}`;

  return (
    <Document>
      <Page size="A4" style={pageStyle}>
        {/* ─── Header: Distributor Branding & Customer Account Details ─── */}
        <View style={currentStyles.headerContainer}>
          <View style={currentStyles.headerLeft}>
            <Text style={currentStyles.orgName}>{organization.name}</Text>
            {orgContact ? (
              <Text style={currentStyles.orgDetail}>{orgContact}</Text>
            ) : null}
            <Text style={currentStyles.orgDetail}>
              GSTIN: {organization.gstin || 'N/A'}
            </Text>
          </View>
          <View style={currentStyles.headerRight}>
            <Text style={currentStyles.docTitle}>{docTitleText}</Text>
            <Text style={currentStyles.customerDetail}>Customer: {customer.name}</Text>
            {customer.phone ? (
              <Text style={currentStyles.customerDetail}>Phone: {customer.phone}</Text>
            ) : null}
            <Text style={currentStyles.customerDetail}>Date: {statementDate}</Text>
          </View>
        </View>

        {/* ─── 5-Column Table ─── */}
        <View style={currentStyles.table}>
          {/* Table Column Headers */}
          <View style={currentStyles.tableHeader}>
            <Text style={[currentStyles.thCell, currentStyles.colDate]}>DATE</Text>
            <Text style={[currentStyles.thCell, currentStyles.colGoodsGiven]}>
              {goodsGivenHeader}
            </Text>
            <Text style={[currentStyles.thCell, currentStyles.colAmount]}>AMOUNT</Text>
            <Text style={[currentStyles.thCell, currentStyles.colReturned]}>RETURNED</Text>
            <Text style={[currentStyles.thCell, currentStyles.colPaymentReceived]}>
              PAYMENT RECEIVED
            </Text>
          </View>

          {/* Unaggregated Transaction Rows */}
          {rows.map((row, idx) => {
            const amountVal = row.amount ?? row.goodsGivenAmount;
            const returnedVal = row.returned ?? row.returnedAmount;
            const paymentVal = row.paymentReceived ?? row.paymentReceivedAmount;

            const isAlt = idx % 2 === 1;

            return (
              <View
                key={idx}
                style={[currentStyles.tableRow, isAlt ? currentStyles.tableRowAlt : {}]}
                wrap={false}
              >
                <Text style={[currentStyles.tdCell, currentStyles.colDate]}>{row.date}</Text>
                <Text style={[currentStyles.tdCell, currentStyles.colGoodsGiven]}>
                  {row.particulars || '—'}
                </Text>
                <Text style={[currentStyles.tdCell, currentStyles.colAmount]}>
                  {formatCellAmount(amountVal)}
                </Text>
                <Text style={[currentStyles.tdCell, currentStyles.colReturned]}>
                  {formatCellAmount(returnedVal)}
                </Text>
                <Text style={[currentStyles.tdCell, currentStyles.colPaymentReceived]}>
                  {formatCellAmount(paymentVal)}
                </Text>
              </View>
            );
          })}
        </View>

        {/* ─── Bottom Account Summary Box ─── */}
        <View style={currentStyles.summaryContainer}>
          <View style={currentStyles.summaryBox} wrap={false}>
            <View style={currentStyles.summaryRow}>
              <Text style={currentStyles.summaryLabel}>TOTAL GOODS GIVEN:</Text>
              <Text style={currentStyles.summaryValue}>
                {`₹ ${Number(summary?.totalGoodsGiven || 0).toFixed(2)}`}
              </Text>
            </View>
            <View style={currentStyles.summaryRow}>
              <Text style={currentStyles.summaryLabel}>LESS: GOODS RETURNED:</Text>
              <Text style={currentStyles.summaryValue}>
                {`₹ ${Number(summary?.totalGoodsReturned || 0).toFixed(2)}`}
              </Text>
            </View>
            <View style={currentStyles.summaryRow}>
              <Text style={currentStyles.summaryLabel}>LESS: PAYMENTS RECEIVED:</Text>
              <Text style={currentStyles.summaryValue}>
                {`₹ ${Number(summary?.totalPaymentsReceived || 0).toFixed(2)}`}
              </Text>
            </View>
            <View style={currentStyles.balanceRow}>
              <Text style={currentStyles.balanceLabel}>BALANCE:</Text>
              <Text style={currentStyles.balanceValue}>
                {`₹ ${Number(summary?.netBalance || 0).toFixed(2)}`}
              </Text>
            </View>
          </View>
        </View>

        {/* ─── Document Footer ─── */}
        <View style={currentStyles.footer}>
          <Text>
            This is a computer-generated account statement. • Powered by DistroAI
          </Text>
          <Text
            render={({ pageNumber, totalPages }: any) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
};

export default RTKStatementPDFDocument;
