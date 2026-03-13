import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { indianAmountToWords } from './amount-to-words';

// Define styling
const styles = StyleSheet.create({
    page: { padding: 30, fontSize: 10, fontFamily: 'Helvetica', color: '#333' },
    headerContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    brandName: { fontSize: 20, color: '#d4a843', fontWeight: 'bold' },
    invoiceTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'right' },
    textMuted: { color: '#666', marginTop: 2 },
    textBold: { fontWeight: 'bold' },

    partySection: { flexDirection: 'row', gap: 15, marginBottom: 20 },
    partyBox: { flex: 1, border: '1pt solid #ddd', borderRadius: 4, padding: 10 },
    partyHeader: { color: '#d4a843', fontWeight: 'bold', marginBottom: 4 },

    table: { width: '100%', border: '1pt solid #ddd', borderBottom: 0 },
    tableHeader: { flexDirection: 'row', backgroundColor: '#1a1625', color: '#f0e8d5', borderBottom: '1pt solid #ddd' },
    tableRow: { flexDirection: 'row', borderBottom: '1pt solid #ddd', alignItems: 'center' },
    tableRowEven: { backgroundColor: '#f9f9f9' },
    colIdx: { width: '4%', padding: 6, textAlign: 'center' },
    colDesc: { width: '22%', padding: 6 },
    colHsn: { width: '8%', padding: 6, textAlign: 'center' },
    colQty: { width: '6%', padding: 6, textAlign: 'right' },
    colUnit: { width: '6%', padding: 6, textAlign: 'center' },
    colRate: { width: '8%', padding: 6, textAlign: 'right' },
    colDisc: { width: '8%', padding: 6, textAlign: 'right' },
    colTaxable: { width: '10%', padding: 6, textAlign: 'right' },
    colTaxPct: { width: '6%', padding: 6, textAlign: 'center' },
    colTaxAmt: { width: '8%', padding: 6, textAlign: 'right' },
    colTotal: { width: '10%', padding: 6, textAlign: 'right', fontWeight: 'bold' },

    colIgstPct: { width: '8%', padding: 6, textAlign: 'center' },
    colIgstAmt: { width: '10%', padding: 6, textAlign: 'right' },

    totalsSection: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 20 },
    totalsBox: { width: 250, border: '1pt solid #ddd', borderRadius: 4, padding: 10 },
    totalsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    grandTotalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: '2pt solid #d4a843', fontSize: 12, fontWeight: 'bold' },
    amountInWords: { fontSize: 8, color: '#666', marginTop: 4 },

    bankSection: { flexDirection: 'row', gap: 15, padding: 10, backgroundColor: '#f9f9f9', borderRadius: 4, marginBottom: 15 },
    bankBox: { flex: 1 },
    bankHeader: { fontSize: 8, color: '#999', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 },

    footer: { textAlign: 'center', fontSize: 8, color: '#999', marginTop: 15 }
});

const formatNum = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const InvoicePDF = ({ invoice }: { invoice: any }) => {
    const org = invoice.organization;
    const customer = invoice.customer;
    const settings = org?.settings || {};
    const isInterState = (org.state || '').toString().toLowerCase() !== (customer.state || '').toString().toLowerCase();
    const amountInWords = indianAmountToWords(Number(invoice.totalAmount));

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <View style={styles.headerContainer}>
                    <View>
                        <Text style={styles.brandName}>{org.name}</Text>
                        <Text style={styles.textMuted}>{org.address || ''}, {org.city || ''} {org.state || ''} {org.pincode || ''}</Text>
                        <Text style={styles.textMuted}>GSTIN: <Text style={styles.textBold}>{org.gstin || 'N/A'}</Text></Text>
                        <Text style={styles.textMuted}>Phone: {org.phone || ''}</Text>
                    </View>
                    <View style={{ textAlign: 'right' }}>
                        <Text style={styles.invoiceTitle}>TAX INVOICE</Text>
                        <Text style={styles.textMuted}>Invoice #: <Text style={styles.textBold}>{invoice.invoiceNumber}</Text></Text>
                        <Text style={styles.textMuted}>Date: {new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}</Text>
                        <Text style={styles.textMuted}>Due Date: {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-IN') : 'N/A'}</Text>
                        <Text style={styles.textMuted}>Place of Supply: {customer.state || org.state || ''}</Text>
                    </View>
                </View>

                {/* Bill To / Ship To */}
                <View style={styles.partySection}>
                    <View style={styles.partyBox}>
                        <Text style={styles.partyHeader}>Bill To:</Text>
                        <Text style={styles.textBold}>{customer.name}</Text>
                        <Text style={styles.textMuted}>{customer.address || ''}, {customer.city || ''} {customer.state || ''}</Text>
                        {customer.gstin ? <Text style={styles.textMuted}>GSTIN: {customer.gstin}</Text> : null}
                        <Text style={styles.textMuted}>Phone: {customer.phone || ''}</Text>
                    </View>
                    <View style={styles.partyBox}>
                        <Text style={styles.partyHeader}>Ship To:</Text>
                        <Text style={styles.textBold}>{customer.name}</Text>
                        <Text style={styles.textMuted}>{customer.address || ''}, {customer.city || ''} {customer.state || ''}</Text>
                    </View>
                </View>

                {/* Item Table */}
                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={{ ...styles.colIdx, color: '#f0e8d5' }}>#</Text>
                        <Text style={{ ...styles.colDesc, color: '#f0e8d5' }}>Description</Text>
                        <Text style={{ ...styles.colHsn, color: '#f0e8d5' }}>HSN</Text>
                        <Text style={{ ...styles.colQty, color: '#f0e8d5' }}>Qty</Text>
                        <Text style={{ ...styles.colUnit, color: '#f0e8d5' }}>Unit</Text>
                        <Text style={{ ...styles.colRate, color: '#f0e8d5' }}>Rate</Text>
                        <Text style={{ ...styles.colDisc, color: '#f0e8d5' }}>Disc.</Text>
                        <Text style={{ ...styles.colTaxable, color: '#f0e8d5' }}>Taxable</Text>

                        {isInterState ? (
                            <>
                                <Text style={{ ...styles.colIgstPct, color: '#f0e8d5' }}>IGST%</Text>
                                <Text style={{ ...styles.colIgstAmt, color: '#f0e8d5' }}>IGST</Text>
                            </>
                        ) : (
                            <>
                                <Text style={{ ...styles.colTaxPct, color: '#f0e8d5' }}>CGST%</Text>
                                <Text style={{ ...styles.colTaxAmt, color: '#f0e8d5' }}>CGST</Text>
                                <Text style={{ ...styles.colTaxPct, color: '#f0e8d5' }}>SGST%</Text>
                                <Text style={{ ...styles.colTaxAmt, color: '#f0e8d5' }}>SGST</Text>
                            </>
                        )}
                        <Text style={{ ...styles.colTotal, color: '#f0e8d5' }}>Total</Text>
                    </View>

                    {invoice.items.map((item: any, idx: number) => {
                        const taxableAmt = Number(item.taxableAmount);
                        const gstRate = Number(item.gstRate);
                        return (
                            <View key={idx} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowEven : {}]}>
                                <Text style={styles.colIdx}>{idx + 1}</Text>
                                <Text style={styles.colDesc}>{item.product?.name || 'Item'}</Text>
                                <Text style={styles.colHsn}>{item.product?.hsnCode || ''}</Text>
                                <Text style={styles.colQty}>{item.quantity}</Text>
                                <Text style={styles.colUnit}>{item.unit}</Text>
                                <Text style={styles.colRate}>{formatNum(Number(item.price))}</Text>
                                <Text style={styles.colDisc}>{formatNum(Number(item.discountAmount))}</Text>
                                <Text style={styles.colTaxable}>{formatNum(taxableAmt)}</Text>

                                {isInterState ? (
                                    <>
                                        <Text style={styles.colIgstPct}>{gstRate}%</Text>
                                        <Text style={styles.colIgstAmt}>{formatNum(Number(item.igstAmount))}</Text>
                                    </>
                                ) : (
                                    <>
                                        <Text style={styles.colTaxPct}>{gstRate / 2}%</Text>
                                        <Text style={styles.colTaxAmt}>{formatNum(Number(item.cgstAmount))}</Text>
                                        <Text style={styles.colTaxPct}>{gstRate / 2}%</Text>
                                        <Text style={styles.colTaxAmt}>{formatNum(Number(item.sgstAmount))}</Text>
                                    </>
                                )}
                                <Text style={styles.colTotal}>{formatNum(Number(item.totalAmount))}</Text>
                            </View>
                        );
                    })}
                </View>

                {/* Totals Box */}
                <View style={styles.totalsSection}>
                    <View style={styles.totalsBox}>
                        <View style={styles.totalsRow}><Text>Subtotal</Text><Text>{formatNum(Number(invoice.totalAmount))}</Text></View>
                        <View style={styles.totalsRow}><Text>Discount</Text><Text>- {formatNum(Number(invoice.discountAmount))}</Text></View>
                        <View style={styles.totalsRow}><Text>Tax</Text><Text>{formatNum(Number(invoice.taxAmount))}</Text></View>
                        <View style={styles.grandTotalRow}>
                            <Text>Grand Total</Text>
                            <Text>₹{formatNum(Number(invoice.netAmount))}</Text>
                        </View>
                        <Text style={styles.amountInWords}>{amountInWords}</Text>
                    </View>
                </View>

                {/* Bank & UPI */}
                <View style={styles.bankSection}>
                    <View style={styles.bankBox}>
                        <Text style={styles.bankHeader}>Bank Details</Text>
                        <Text style={styles.textMuted}>{settings.bankName || 'N/A'}</Text>
                        <Text style={styles.textMuted}>A/C: {settings.bankAccountNumber || 'N/A'}</Text>
                        <Text style={styles.textMuted}>IFSC: {settings.bankIfscCode || 'N/A'}</Text>
                    </View>
                    <View style={{ ...styles.bankBox, textAlign: 'center' }}>
                        <Text style={styles.bankHeader}>UPI</Text>
                        <Text style={styles.textMuted}>{settings.upiId || 'N/A'}</Text>
                    </View>
                </View>

                {invoice.eInvoiceIrn && (
                    <View style={{ marginTop: 15, alignItems: 'center' }}>
                        {invoice.qrCodeDataUri && (
                            <Image src={invoice.qrCodeDataUri} style={{ width: 80, height: 80, marginBottom: 4 }} />
                        )}
                        <Text style={{ fontSize: 8, color: '#666', marginBottom: 2 }}>IRN: {invoice.eInvoiceIrn}</Text>
                        {invoice.eInvoiceAckNo && (
                            <Text style={{ fontSize: 8, color: '#666' }}>
                                Ack No: {invoice.eInvoiceAckNo}  •  Ack Date: {invoice.eInvoiceAckDate}
                            </Text>
                        )}
                    </View>
                )}
                <Text style={styles.footer}>This is a computer generated invoice. Signature not required.</Text>
            </Page>
        </Document>
    );
};

export default InvoicePDF;
