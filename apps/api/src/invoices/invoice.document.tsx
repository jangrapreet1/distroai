import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { indianAmountToWords } from './amount-to-words';

/* ─── Color palette ─── */
const GOLD = '#C9A84C';
const DARK = '#1a1625';
const LIGHT_TEXT = '#f0e8d5';
const MUTED = '#666';
const BORDER = '#ddd';
const ALT_ROW = '#f8f7f5';
const WHITE = '#ffffff';

/* ─── Styles ─── */
const s = StyleSheet.create({
    page: { padding: 30, fontSize: 9.5, fontFamily: 'Helvetica', color: '#333', backgroundColor: WHITE },

    /* Header */
    header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18, paddingBottom: 12, borderBottom: `2pt solid ${GOLD}` },
    headerLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1 },
    logo: { width: 50, height: 50, borderRadius: 4 },
    brandName: { fontSize: 18, fontWeight: 'bold', color: DARK },
    orgDetail: { fontSize: 8.5, color: MUTED, marginTop: 1.5 },
    headerRight: { textAlign: 'right', alignItems: 'flex-end' },
    invoiceTitle: { fontSize: 20, fontWeight: 'bold', color: DARK, letterSpacing: 1 },
    statusBadge: { fontSize: 8, fontWeight: 'bold', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginTop: 4, alignSelf: 'flex-end' },
    metaLabel: { fontSize: 8, color: MUTED, marginTop: 2 },
    metaValue: { fontWeight: 'bold' },

    /* Party section */
    partyRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
    partyBox: { flex: 1, border: `1pt solid ${BORDER}`, borderRadius: 4, padding: 10 },
    partyTag: { fontSize: 7, fontWeight: 'bold', color: GOLD, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
    partyName: { fontWeight: 'bold', fontSize: 10, marginBottom: 2 },
    partyText: { fontSize: 8.5, color: MUTED, marginTop: 1 },

    /* Table */
    table: { width: '100%', marginBottom: 14 },
    thRow: { flexDirection: 'row', backgroundColor: DARK, borderTopLeftRadius: 4, borderTopRightRadius: 4, paddingVertical: 1 },
    thCell: { color: LIGHT_TEXT, fontWeight: 'bold', fontSize: 7.5, textTransform: 'uppercase', letterSpacing: 0.5, padding: 6 },
    tdRow: { flexDirection: 'row', borderBottom: `0.5pt solid ${BORDER}`, alignItems: 'center' },
    tdRowAlt: { backgroundColor: ALT_ROW },
    tdCell: { fontSize: 9, padding: 6 },

    /* Column widths */
    colIdx: { width: '4%', textAlign: 'center' },
    colDesc: { width: '26%' },
    colHsn: { width: '8%', textAlign: 'center' },
    colQty: { width: '6%', textAlign: 'right' },
    colUnit: { width: '5%', textAlign: 'center' },
    colRate: { width: '9%', textAlign: 'right' },
    colDisc: { width: '7%', textAlign: 'right' },
    colTaxable: { width: '10%', textAlign: 'right' },
    colTaxPct: { width: '5%', textAlign: 'center' },
    colTaxAmt: { width: '8%', textAlign: 'right' },
    colTotal: { width: '10%', textAlign: 'right', fontWeight: 'bold' },
    colIgstPct: { width: '7%', textAlign: 'center' },
    colIgstAmt: { width: '10%', textAlign: 'right' },

    /* Totals */
    totalsSection: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 16 },
    totalsBox: { width: 260, border: `1pt solid ${BORDER}`, borderRadius: 4, padding: 10 },
    totalsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3, fontSize: 9 },
    grandTotalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingTop: 6, borderTop: `2pt solid ${GOLD}`, fontSize: 12, fontWeight: 'bold' },
    amountWords: { fontSize: 7.5, color: MUTED, marginTop: 5, fontStyle: 'italic' },

    /* Bank */
    bankRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
    bankBox: { flex: 1, backgroundColor: '#faf9f7', border: `0.5pt solid ${BORDER}`, borderRadius: 4, padding: 9 },
    bankTag: { fontSize: 7, fontWeight: 'bold', color: MUTED, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3 },
    bankText: { fontSize: 8.5, color: '#444', marginTop: 1 },
    bankBold: { fontWeight: 'bold' },

    /* Signature */
    sigBox: { alignItems: 'flex-end', marginTop: 20, marginBottom: 8 },
    sigLine: { width: 160, borderBottom: `1pt solid ${BORDER}`, marginTop: 40, marginBottom: 4 },
    sigLabel: { fontSize: 8, color: MUTED },
    sigName: { fontSize: 9, fontWeight: 'bold', marginBottom: 2 },

    /* Terms */
    termsSection: { marginTop: 8, paddingTop: 8, borderTop: `0.5pt solid ${BORDER}` },
    termsTitle: { fontSize: 7, fontWeight: 'bold', color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
    termsText: { fontSize: 7.5, color: MUTED, lineHeight: 1.5 },

    /* E-Invoice */
    eInvoiceSection: { alignItems: 'center', marginTop: 12 },
    qrImage: { width: 80, height: 80, marginBottom: 4 },
    eInvoiceText: { fontSize: 7, color: MUTED },

    /* Footer */
    footer: { textAlign: 'center', fontSize: 7, color: '#aaa', marginTop: 12 },
});

const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    DRAFT: { bg: '#eee', text: '#888' },
    SENT: { bg: '#ede9f6', text: '#7B5EA7' },
    PAID: { bg: '#e6f5ed', text: '#2E8B57' },
    PARTIAL: { bg: '#fef3e2', text: '#E07B39' },
    OVERDUE: { bg: '#fce8e4', text: '#E07B60' },
    CANCELLED: { bg: '#fce8e4', text: '#E07B60' },
};

const InvoicePDF = ({ invoice }: { invoice: any }) => {
    const org = invoice.organization ?? {};
    const customer = invoice.customer ?? {};
    const settings = org.settings ?? {};
    const items: any[] = invoice.items ?? [];

    const isInterState = (org.state || '').toLowerCase() !== (customer.state || '').toLowerCase();
    const amountInWords = indianAmountToWords(Number(invoice.totalAmount ?? 0));

    const totalTax = Number(invoice.cgstAmount ?? 0) + Number(invoice.sgstAmount ?? 0) + Number(invoice.igstAmount ?? 0) + Number(invoice.cessAmount ?? 0);

    const statusColor = STATUS_COLORS[invoice.status] ?? STATUS_COLORS.DRAFT;

    const hasBankDetails = settings.bankName || settings.bankAccountNumber;

    return (
        <Document>
            <Page size="A4" style={s.page}>
                {/* ─── Header ─── */}
                <View style={s.header}>
                    <View style={s.headerLeft}>
                        {org.logoUrl && <Image src={org.logoUrl} style={s.logo} />}
                        <View>
                            <Text style={s.brandName}>{org.name || 'Company'}</Text>
                            <Text style={s.orgDetail}>{[org.address, org.city, org.state, org.pincode].filter(Boolean).join(', ')}</Text>
                            {org.gstNumber && <Text style={s.orgDetail}>GSTIN: <Text style={{ fontWeight: 'bold' }}>{org.gstNumber}</Text></Text>}
                            {org.panNumber && <Text style={s.orgDetail}>PAN: {org.panNumber}</Text>}
                            {org.phone && <Text style={s.orgDetail}>Phone: {org.phone}</Text>}
                            {org.email && <Text style={s.orgDetail}>Email: {org.email}</Text>}
                        </View>
                    </View>
                    <View style={s.headerRight}>
                        <Text style={s.invoiceTitle}>TAX INVOICE</Text>
                        <View style={[s.statusBadge, { backgroundColor: statusColor.bg }]}>
                            <Text style={{ color: statusColor.text, fontSize: 8, fontWeight: 'bold' }}>{invoice.status}</Text>
                        </View>
                        <Text style={s.metaLabel}>Invoice #: <Text style={s.metaValue}>{invoice.invoiceNumber}</Text></Text>
                        <Text style={s.metaLabel}>Date: {new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}</Text>
                        <Text style={s.metaLabel}>Due: {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-IN') : 'N/A'}</Text>
                        <Text style={s.metaLabel}>Place of Supply: {invoice.placeOfSupply || customer.state || org.state || ''}</Text>
                    </View>
                </View>

                {/* ─── Bill To / Ship To ─── */}
                <View style={s.partyRow}>
                    <View style={s.partyBox}>
                        <Text style={s.partyTag}>Bill To</Text>
                        <Text style={s.partyName}>{customer.name || 'Customer'}</Text>
                        <Text style={s.partyText}>{[customer.address, customer.city, customer.state].filter(Boolean).join(', ')}</Text>
                        {customer.gstNumber && <Text style={s.partyText}>GSTIN: {customer.gstNumber}</Text>}
                        {customer.phone && <Text style={s.partyText}>Phone: {customer.phone}</Text>}
                    </View>
                    <View style={s.partyBox}>
                        <Text style={s.partyTag}>Ship To</Text>
                        <Text style={s.partyName}>{customer.name || 'Customer'}</Text>
                        <Text style={s.partyText}>{[customer.address, customer.city, customer.state].filter(Boolean).join(', ')}</Text>
                    </View>
                </View>

                {/* ─── Items Table ─── */}
                <View style={s.table}>
                    {/* Header */}
                    <View style={s.thRow}>
                        <Text style={[s.thCell, s.colIdx]}>#</Text>
                        <Text style={[s.thCell, s.colDesc]}>Description</Text>
                        <Text style={[s.thCell, s.colHsn]}>HSN</Text>
                        <Text style={[s.thCell, s.colQty]}>Qty</Text>
                        <Text style={[s.thCell, s.colUnit]}>Unit</Text>
                        <Text style={[s.thCell, s.colRate]}>Rate</Text>
                        <Text style={[s.thCell, s.colDisc]}>Disc.</Text>
                        <Text style={[s.thCell, s.colTaxable]}>Taxable</Text>
                        {isInterState ? (
                            <>
                                <Text style={[s.thCell, s.colIgstPct]}>IGST%</Text>
                                <Text style={[s.thCell, s.colIgstAmt]}>IGST</Text>
                            </>
                        ) : (
                            <>
                                <Text style={[s.thCell, s.colTaxPct]}>CGST%</Text>
                                <Text style={[s.thCell, s.colTaxAmt]}>CGST</Text>
                                <Text style={[s.thCell, s.colTaxPct]}>SGST%</Text>
                                <Text style={[s.thCell, s.colTaxAmt]}>SGST</Text>
                            </>
                        )}
                        <Text style={[s.thCell, s.colTotal]}>Total</Text>
                    </View>

                    {/* Rows */}
                    {items.map((item: any, idx: number) => {
                        const gstRate = Number(item.gstRate ?? 0);
                        return (
                            <View key={idx} style={[s.tdRow, idx % 2 === 1 ? s.tdRowAlt : {}]} wrap={false}>
                                <Text style={[s.tdCell, s.colIdx]}>{idx + 1}</Text>
                                <Text style={[s.tdCell, s.colDesc]}>{item.product?.name || item.description || 'Item'}</Text>
                                <Text style={[s.tdCell, s.colHsn]}>{item.hsnCode || item.product?.hsnCode || ''}</Text>
                                <Text style={[s.tdCell, s.colQty]}>{item.quantity}</Text>
                                <Text style={[s.tdCell, s.colUnit]}>{item.unit}</Text>
                                <Text style={[s.tdCell, s.colRate]}>{fmt(Number(item.price ?? 0))}</Text>
                                <Text style={[s.tdCell, s.colDisc]}>{fmt(Number(item.discount ?? 0))}</Text>
                                <Text style={[s.tdCell, s.colTaxable]}>{fmt(Number(item.taxableAmt ?? 0))}</Text>
                                {isInterState ? (
                                    <>
                                        <Text style={[s.tdCell, s.colIgstPct]}>{gstRate}%</Text>
                                        <Text style={[s.tdCell, s.colIgstAmt]}>{fmt(Number(item.igstAmount ?? 0))}</Text>
                                    </>
                                ) : (
                                    <>
                                        <Text style={[s.tdCell, s.colTaxPct]}>{gstRate / 2}%</Text>
                                        <Text style={[s.tdCell, s.colTaxAmt]}>{fmt(Number(item.cgstAmount ?? 0))}</Text>
                                        <Text style={[s.tdCell, s.colTaxPct]}>{gstRate / 2}%</Text>
                                        <Text style={[s.tdCell, s.colTaxAmt]}>{fmt(Number(item.sgstAmount ?? 0))}</Text>
                                    </>
                                )}
                                <Text style={[s.tdCell, s.colTotal]}>{fmt(Number(item.totalAmount ?? 0))}</Text>
                            </View>
                        );
                    })}
                </View>

                {/* ─── Totals ─── */}
                <View style={s.totalsSection}>
                    <View style={s.totalsBox}>
                        <View style={s.totalsRow}><Text>Subtotal</Text><Text>{fmt(Number(invoice.subtotal ?? 0))}</Text></View>
                        {Number(invoice.discountAmount ?? 0) > 0 && (
                            <View style={s.totalsRow}><Text>Discount</Text><Text>- {fmt(Number(invoice.discountAmount))}</Text></View>
                        )}
                        <View style={s.totalsRow}><Text style={{ color: MUTED }}>Taxable Amount</Text><Text>{fmt(Number(invoice.taxableAmount ?? 0))}</Text></View>
                        {isInterState ? (
                            <View style={s.totalsRow}><Text style={{ color: MUTED }}>IGST</Text><Text>{fmt(Number(invoice.igstAmount ?? 0))}</Text></View>
                        ) : (
                            <>
                                <View style={s.totalsRow}><Text style={{ color: MUTED }}>CGST</Text><Text>{fmt(Number(invoice.cgstAmount ?? 0))}</Text></View>
                                <View style={s.totalsRow}><Text style={{ color: MUTED }}>SGST</Text><Text>{fmt(Number(invoice.sgstAmount ?? 0))}</Text></View>
                            </>
                        )}
                        {Number(invoice.cessAmount ?? 0) > 0 && (
                            <View style={s.totalsRow}><Text style={{ color: MUTED }}>Cess</Text><Text>{fmt(Number(invoice.cessAmount))}</Text></View>
                        )}

                        <View style={s.grandTotalRow}>
                            <Text>Grand Total</Text>
                            <Text>₹{fmt(Number(invoice.totalAmount ?? 0))}</Text>
                        </View>
                        <Text style={s.amountWords}>{amountInWords}</Text>

                        {Number(invoice.paidAmount ?? 0) > 0 && (
                            <>
                                <View style={[s.totalsRow, { marginTop: 6 }]}><Text style={{ color: '#2E8B57' }}>Paid</Text><Text style={{ color: '#2E8B57' }}>₹{fmt(Number(invoice.paidAmount))}</Text></View>
                                <View style={s.totalsRow}><Text style={{ fontWeight: 'bold' }}>Balance Due</Text><Text style={{ fontWeight: 'bold', color: Number(invoice.balanceAmount ?? 0) > 0 ? '#E07B39' : '#2E8B57' }}>₹{fmt(Number(invoice.balanceAmount ?? 0))}</Text></View>
                            </>
                        )}
                    </View>
                </View>

                {/* ─── Bank & UPI ─── */}
                {hasBankDetails && (
                    <View style={s.bankRow}>
                        <View style={s.bankBox}>
                            <Text style={s.bankTag}>Bank Details</Text>
                            {settings.bankName && <Text style={s.bankText}><Text style={s.bankBold}>{settings.bankName}</Text></Text>}
                            {settings.bankAccountNumber && <Text style={s.bankText}>A/C: <Text style={s.bankBold}>{settings.bankAccountNumber}</Text></Text>}
                            {settings.bankIfscCode && <Text style={s.bankText}>IFSC: {settings.bankIfscCode}</Text>}
                            {settings.bankBranch && <Text style={s.bankText}>Branch: {settings.bankBranch}</Text>}
                        </View>
                        {settings.upiId && (
                            <View style={[s.bankBox, { textAlign: 'center', flex: 0.6 }]}>
                                <Text style={s.bankTag}>UPI Payment</Text>
                                <Text style={[s.bankText, s.bankBold]}>{settings.upiId}</Text>
                            </View>
                        )}
                    </View>
                )}

                {/* ─── E-Invoice ─── */}
                {invoice.eInvoiceIrn && (
                    <View style={s.eInvoiceSection}>
                        {invoice.qrCodeDataUri && <Image src={invoice.qrCodeDataUri} style={s.qrImage} />}
                        <Text style={s.eInvoiceText}>IRN: {invoice.eInvoiceIrn}</Text>
                        {invoice.eInvoiceAckNo && (
                            <Text style={s.eInvoiceText}>Ack No: {invoice.eInvoiceAckNo}  •  Ack Date: {invoice.eInvoiceAckDate}</Text>
                        )}
                    </View>
                )}

                {/* ─── Authorized Signatory ─── */}
                <View style={s.sigBox}>
                    <Text style={s.sigName}>For {org.name || 'Company'}</Text>
                    <View style={s.sigLine} />
                    <Text style={s.sigLabel}>Authorized Signatory</Text>
                </View>

                {/* ─── Terms & Conditions ─── */}
                <View style={s.termsSection}>
                    <Text style={s.termsTitle}>Terms & Conditions</Text>
                    <Text style={s.termsText}>1. Payment is due by the date mentioned above.</Text>
                    <Text style={s.termsText}>2. Goods once sold will not be taken back or exchanged.</Text>
                    <Text style={s.termsText}>3. Subject to local jurisdiction only.</Text>
                    <Text style={s.termsText}>4. E. & O.E. (Errors and Omissions Excepted)</Text>
                </View>

                {/* ─── Footer ─── */}
                <Text style={s.footer}>This is a computer-generated invoice. • Powered by DistroAI</Text>
            </Page>
        </Document>
    );
};

export default InvoicePDF;
