import React from 'react';
import { registerDevanagariFonts } from '../customer-transactions/font-registry';

export function getReactPdf(customReactPdf?: any) {
  if (customReactPdf) return customReactPdf;
  try {
    return require('@react-pdf/renderer');
  } catch {
    return null;
  }
}

export interface SupplierStatementRowData {
  date: string;
  itemName: string;
  quantity?: number | null;
  cost?: number | null;
  worth?: number | null;
  returned?: number | null;
  amountPaid?: number | null;
  balance?: number;
  poNumber?: string;
  type?: 'PURCHASE_ITEM' | 'PAYMENT' | 'RETURN';
}

export interface SupplierStatementSummaryData {
  totalWorth: number;
  totalReturned: number;
  totalPaid: number;
  balance: number;
  totalItemsCount?: number;
}

export interface SupplierStatementData {
  organization: {
    name: string;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    phone?: string | null;
    gstin?: string | null;
  };
  supplier: {
    id?: string;
    name: string;
    phone?: string | null;
    city?: string | null;
    address?: string | null;
    gstNumber?: string | null;
  };
  statementDate: string;
  rows: SupplierStatementRowData[];
  summary: SupplierStatementSummaryData;
}

const PRIMARY_NAVY = '#1e3a8a';
const BORDER_COLOR = '#94a3b8';
const HEADER_BG = '#e2e8f0';
const ALT_ROW_BG = '#f8fafc';
const TEXT_MAIN = '#0f172a';
const TEXT_MUTED = '#64748b';

let cachedStyles: any = null;
export function getStyles(StyleSheet: any) {
  if (cachedStyles) return cachedStyles;
  if (!StyleSheet || typeof StyleSheet.create !== 'function') return {};

  cachedStyles = StyleSheet.create({
    page: {
      padding: 24,
      fontSize: 8.5,
      fontFamily: 'NotoSansDevanagari',
      color: TEXT_MAIN,
      backgroundColor: '#ffffff',
    },
    headerContainer: {
      textAlign: 'center',
      marginBottom: 14,
      borderBottom: `2pt solid ${PRIMARY_NAVY}`,
      paddingBottom: 8,
    },
    title: {
      fontSize: 16,
      fontWeight: 'bold',
      letterSpacing: 1.5,
      color: PRIMARY_NAVY,
      textTransform: 'uppercase',
      marginBottom: 3,
    },
    subtitle: {
      fontSize: 10,
      color: TEXT_MUTED,
      marginBottom: 4,
    },
    supplierPill: {
      fontSize: 10.5,
      fontWeight: 'bold',
      color: TEXT_MAIN,
      marginTop: 2,
    },
    table: {
      width: '100%',
      borderTop: `1pt solid ${BORDER_COLOR}`,
      borderLeft: `1pt solid ${BORDER_COLOR}`,
      marginBottom: 14,
    },
    tableHeader: {
      flexDirection: 'row',
      backgroundColor: HEADER_BG,
      borderBottom: `1.5pt solid ${BORDER_COLOR}`,
      fontWeight: 'bold',
    },
    tableRow: {
      flexDirection: 'row',
      borderBottom: `1pt solid ${BORDER_COLOR}`,
      minHeight: 20,
      alignItems: 'center',
    },
    tableRowAlt: {
      backgroundColor: ALT_ROW_BG,
    },
    thCell: {
      fontSize: 7.5,
      fontWeight: 'bold',
      padding: 4,
      borderRight: `1pt solid ${BORDER_COLOR}`,
      textAlign: 'center',
      color: '#1e293b',
    },
    tdCell: {
      fontSize: 7.5,
      padding: 4,
      borderRight: `1pt solid ${BORDER_COLOR}`,
      color: TEXT_MAIN,
    },
    // 8 Exact Columns from user's image (Sum = 100%)
    colDate: { width: '11%', textAlign: 'center' },
    colItemName: { width: '27%' },
    colQuantity: { width: '8%', textAlign: 'center' },
    colCost: { width: '10%', textAlign: 'right' },
    colWorth: { width: '12%', textAlign: 'right' },
    colReturned: { width: '10%', textAlign: 'right' },
    colPaid: { width: '11%', textAlign: 'right' },
    colBalance: { width: '11%', textAlign: 'right' },

    // Bottom Summary Box
    summaryContainer: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      marginTop: 8,
    },
    summaryBox: {
      width: 320,
      border: `1pt solid ${PRIMARY_NAVY}`,
      borderRadius: 2,
      overflow: 'hidden',
    },
    summaryHeader: {
      backgroundColor: PRIMARY_NAVY,
      color: '#ffffff',
      fontSize: 8.5,
      fontWeight: 'bold',
      padding: 4,
      textAlign: 'center',
      letterSpacing: 0.5,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 8,
      paddingVertical: 3.5,
      borderBottom: `0.5pt solid ${BORDER_COLOR}`,
      fontSize: 8,
    },
    summaryLabel: {
      fontWeight: 'bold',
      color: TEXT_MAIN,
    },
    summaryValue: {
      fontWeight: 'bold',
      color: TEXT_MAIN,
    },
    summaryBalanceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 8,
      paddingVertical: 5,
      backgroundColor: '#f1f5f9',
      fontSize: 9.5,
      fontWeight: 'bold',
    },
    footer: {
      position: 'absolute',
      bottom: 12,
      left: 24,
      right: 24,
      borderTop: `0.5pt solid ${BORDER_COLOR}`,
      paddingTop: 4,
      flexDirection: 'row',
      justifyContent: 'space-between',
      fontSize: 7,
      color: TEXT_MUTED,
    },
  });

  return cachedStyles;
}

const formatCurrency = (n: number | null | undefined): string => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const SupplierStatementPDFDocument: React.FC<{
  statement: SupplierStatementData;
  reactPdf?: any;
}> = ({ statement, reactPdf }) => {
  const ReactPDF = getReactPdf(reactPdf);
  if (!ReactPDF) return null;

  registerDevanagariFonts(ReactPDF.Font);

  const { Document, Page, Text, View } = ReactPDF;
  const currentStyles = getStyles(ReactPDF.StyleSheet);

  const { organization, supplier, statementDate, rows, summary } = statement;

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={currentStyles.page}>
        {/* ─── Header matching user's spec ─── */}
        <View style={currentStyles.headerContainer}>
          <Text style={currentStyles.title}>ACCOUNT SUMMARY</Text>
          <Text style={currentStyles.subtitle}>
            {organization.name}
            {organization.city ? ` • ${organization.city}` : ''}
            {organization.gstin ? ` • GSTIN: ${organization.gstin}` : ''}
          </Text>
          <Text style={currentStyles.supplierPill}>
            Supplier: {supplier.name}
            {supplier.phone ? ` (${supplier.phone})` : ''}
            {`  •  Date: ${statementDate}`}
          </Text>
        </View>

        {/* ─── 8-Column Table ─── */}
        <View style={currentStyles.table}>
          <View style={currentStyles.tableHeader}>
            <Text style={[currentStyles.thCell, currentStyles.colDate]}>DATE</Text>
            <Text style={[currentStyles.thCell, currentStyles.colItemName]}>Items Received (name)</Text>
            <Text style={[currentStyles.thCell, currentStyles.colQuantity]}>Quantity</Text>
            <Text style={[currentStyles.thCell, currentStyles.colCost]}>Cost of 1</Text>
            <Text style={[currentStyles.thCell, currentStyles.colWorth]}>Worth items recieved</Text>
            <Text style={[currentStyles.thCell, currentStyles.colReturned]}>RETURNED</Text>
            <Text style={[currentStyles.thCell, currentStyles.colPaid]}>Amount Paid</Text>
            <Text style={[currentStyles.thCell, currentStyles.colBalance]}>Balance</Text>
          </View>

          {rows.length === 0 ? (
            <View style={currentStyles.tableRow}>
              <Text style={[currentStyles.tdCell, { width: '100%', textAlign: 'center', padding: 12, color: TEXT_MUTED }]}>
                No transaction records found for this period.
              </Text>
            </View>
          ) : (
            rows.map((row, idx) => (
              <View
                key={idx}
                style={[currentStyles.tableRow, idx % 2 === 1 ? currentStyles.tableRowAlt : {}]}
                wrap={false}
              >
                <Text style={[currentStyles.tdCell, currentStyles.colDate]}>{row.date}</Text>
                <Text style={[currentStyles.tdCell, currentStyles.colItemName]}>{row.itemName}</Text>
                <Text style={[currentStyles.tdCell, currentStyles.colQuantity]}>
                  {row.quantity != null ? String(row.quantity) : '—'}
                </Text>
                <Text style={[currentStyles.tdCell, currentStyles.colCost]}>
                  {row.cost != null ? formatCurrency(row.cost) : '—'}
                </Text>
                <Text style={[currentStyles.tdCell, currentStyles.colWorth]}>
                  {row.worth != null ? formatCurrency(row.worth) : '—'}
                </Text>
                <Text style={[currentStyles.tdCell, currentStyles.colReturned]}>
                  {row.returned != null ? formatCurrency(row.returned) : '—'}
                </Text>
                <Text style={[currentStyles.tdCell, currentStyles.colPaid]}>
                  {row.amountPaid != null ? formatCurrency(row.amountPaid) : '—'}
                </Text>
                <Text style={[currentStyles.tdCell, currentStyles.colBalance, { fontWeight: 'bold' }]}>
                  {row.balance != null ? formatCurrency(row.balance) : '—'}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* ─── Bottom Account Summary Box ─── */}
        <View style={currentStyles.summaryContainer} wrap={false}>
          <View style={currentStyles.summaryBox}>
            <Text style={currentStyles.summaryHeader}>ACCOUNT SUMMARY</Text>
            <View style={currentStyles.summaryRow}>
              <Text style={currentStyles.summaryLabel}>Total Worth items Received:</Text>
              <Text style={currentStyles.summaryValue}>{formatCurrency(summary.totalWorth)}</Text>
            </View>
            <View style={currentStyles.summaryRow}>
              <Text style={currentStyles.summaryLabel}>Less: RETURNED:</Text>
              <Text style={[currentStyles.summaryValue, { color: '#b91c1c' }]}>{formatCurrency(summary.totalReturned)}</Text>
            </View>
            <View style={currentStyles.summaryRow}>
              <Text style={currentStyles.summaryLabel}>Less: Paid:</Text>
              <Text style={[currentStyles.summaryValue, { color: '#047857' }]}>{formatCurrency(summary.totalPaid)}</Text>
            </View>
            <View style={currentStyles.summaryBalanceRow}>
              <Text style={[currentStyles.summaryLabel, { color: PRIMARY_NAVY }]}>BALANCE (Payable):</Text>
              <Text style={[currentStyles.summaryValue, { color: PRIMARY_NAVY }]}>{formatCurrency(summary.balance)}</Text>
            </View>
          </View>
        </View>

        {/* ─── Footer ─── */}
        <View style={currentStyles.footer} fixed>
          <Text>Generated via DistroAI • Confidential Trading Record</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
};
