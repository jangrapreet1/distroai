import { create } from 'xmlbuilder2';

export interface SalesReceiptData {
    id: string;
    date: string; // YYYYMMDD format
    customerName: string;
    amount: number;
    receiptNumber: string;
}

export function generateSalesReceiptXml(data: SalesReceiptData): string {
    const doc = create({ version: '1.0' })
        .ele('ENVELOPE')
        .ele('HEADER')
        .ele('TALLYREQUEST').txt('Import Data').up()
        .up()
        .ele('BODY')
        .ele('IMPORTDATA')
        .ele('REQUESTDESC')
        .ele('REPORTNAME').txt('Vouchers').up()
        .ele('STATICVARIABLES')
        .ele('SVCURRENTCOMPANY').txt('DistroAI Company').up()
        .up()
        .up()
        .ele('REQUESTDATA')
        .ele('TALLYMESSAGE', { 'xmlns:UDF': 'TallyUDF' })
        .ele('VOUCHER', { VCHTYPE: 'Receipt', ACTION: 'Create', OBJVIEW: 'Accounting Voucher View' })
        .ele('DATE').txt(data.date).up()
        .ele('VOUCHERTYPENAME').txt('Receipt').up()
        .ele('VOUCHERNUMBER').txt(data.receiptNumber).up()
        .ele('PARTYLEDGERNAME').txt(data.customerName).up()
        .ele('PERSISTEDVIEW').txt('Accounting Voucher View').up()
        .ele('ALLLEDGERENTRIES.LIST')
        .ele('LEDGERNAME').txt(data.customerName).up()
        .ele('ISDEEMEDPOSITIVE').txt('No').up()
        .ele('LEDGERFROMITEM').txt('No').up()
        .ele('REMOVEZEROENTRIES').txt('No').up()
        .ele('ISPARTYLEDGER').txt('Yes').up()
        .ele('AMOUNT').txt(data.amount.toString()).up()
        .up()
        .ele('ALLLEDGERENTRIES.LIST')
        .ele('LEDGERNAME').txt('Cash').up()
        .ele('ISDEEMEDPOSITIVE').txt('Yes').up()
        .ele('LEDGERFROMITEM').txt('No').up()
        .ele('REMOVEZEROENTRIES').txt('No').up()
        .ele('ISPARTYLEDGER').txt('No').up()
        .ele('AMOUNT').txt('-' + data.amount.toString()).up()
        .up()
        .up()
        .up()
        .up()
        .up()
        .up()
        .up();

    return doc.end({ prettyPrint: true });
}
