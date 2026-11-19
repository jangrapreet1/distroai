import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';

export interface EWayBillInput {
    vehicleNo: string;
    transporterName?: string;
    transporterId?: string;
    distanceKm?: number;
    transportDocNo?: string;
    transportMode?: string;
}

export interface EWayBillResult {
    ewayBillNo: string;
    ewayBillDate: string;
    validUpto: string;
    vehicleNo: string;
    fromPlace: string;
    toPlace: string;
    distance: number;
    transporterName?: string;
}

@Injectable()
export class EInvoiceService {
    private readonly logger = new Logger(EInvoiceService.name);
    private readonly nicUrl: string;
    private readonly username: string;
    private readonly password: string;
    private readonly isConfigured: boolean;
    private authToken: string | null = null;
    private tokenExpiry: Date | null = null;

    constructor(
        private config: ConfigService,
        private prisma: PrismaService,
    ) {
        this.nicUrl = config.get<string>('NIC_EINVOICE_URL', 'https://einv-apisandbox.nic.in');
        this.username = config.get<string>('NIC_EINVOICE_USERNAME', '');
        this.password = config.get<string>('NIC_EINVOICE_PASSWORD', '');
        this.isConfigured = !!(this.username && this.password);

        if (!this.isConfigured) {
            this.logger.warn('NIC E-Invoice/E-Waybill not configured — will return mock sandbox responses');
        }
    }

    async authenticate(): Promise<string> {
        if (this.authToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
            return this.authToken;
        }

        if (!this.isConfigured) {
            this.authToken = 'mock-einvoice-token';
            this.tokenExpiry = new Date(Date.now() + 6 * 3600 * 1000);
            return this.authToken;
        }

        try {
            const res = await axios.post(`${this.nicUrl}/eivital/v1.04/auth`, {
                UserName: this.username,
                Password: this.password,
                AppKey: Buffer.from(this.username).toString('base64'),
                ForceRefreshAccessToken: false,
            });
            this.authToken = res.data.AuthToken;
            this.tokenExpiry = new Date(Date.now() + 6 * 3600 * 1000); // 6 hours
            return this.authToken!;
        } catch (err) {
            this.logger.error('E-Invoice auth failed', (err as Error).message);
            throw err;
        }
    }

    async generateIRN(invoiceId: string): Promise<{
        irn: string; ackNo: string; ackDate: string; signedQRCode: string; signedInvoice: string;
    }> {
        const invoice = await this.prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: {
                items: { include: { product: true } },
                customer: true,
                organization: true,
            },
        }) as any;
        if (!invoice) throw new Error(`Invoice ${invoiceId} not found`);

        if (!this.isConfigured) {
            const mockIrn = `IRN${Date.now().toString(36).toUpperCase()}`;
            const mockAck = `ACK${Date.now()}`;
            const mockDate = new Date().toISOString();
            const mockQr = 'mock-qr-code';

            await this.prisma.invoice.update({
                where: { id: invoiceId },
                data: {
                    eInvoiceIrn: mockIrn,
                    eInvoiceAckNo: mockAck,
                    eInvoiceAckDate: mockDate,
                    eInvoiceQrCode: mockQr,
                },
            });
            return {
                irn: mockIrn,
                ackNo: mockAck,
                ackDate: mockDate,
                signedQRCode: mockQr,
                signedInvoice: 'mock-signed',
            };
        }

        const token = await this.authenticate();
        const payload = this.buildEInvoicePayload(invoice);

        try {
            const res = await axios.post(`${this.nicUrl}/eicore/v1.03/Invoice`, payload, {
                headers: { AuthToken: token, 'Content-Type': 'application/json' },
            });

            const data = res.data;
            await this.prisma.invoice.update({
                where: { id: invoiceId },
                data: {
                    eInvoiceIrn: data.Irn,
                    eInvoiceAckNo: data.AckNo?.toString(),
                    eInvoiceAckDate: data.AckDt,
                    eInvoiceQrCode: data.SignedQRCode,
                },
            });

            return {
                irn: data.Irn,
                ackNo: data.AckNo,
                ackDate: data.AckDt,
                signedQRCode: data.SignedQRCode,
                signedInvoice: data.SignedInvoice,
            };
        } catch (err) {
            this.logger.error(`E-Invoice generation failed for ${invoice.invoiceNumber}`, (err as Error).message);
            throw err;
        }
    }

    async generateEWayBill(invoiceId: string, dto: EWayBillInput): Promise<EWayBillResult> {
        const invoice = await this.prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: {
                items: { include: { product: true } },
                customer: true,
                organization: true,
            },
        }) as any;
        if (!invoice) throw new Error(`Invoice ${invoiceId} not found`);

        const distance = dto.distanceKm && dto.distanceKm > 0 ? dto.distanceKm : 100;
        // In India, 1 day validity per 200 km, minimum 1 day
        const validityDays = Math.max(1, Math.ceil(distance / 200));
        const now = new Date();
        const validUpto = new Date(now.getTime() + validityDays * 24 * 3600 * 1000).toISOString();
        const nowIso = now.toISOString();

        let ewbNo: string;

        if (!this.isConfigured) {
            // Generate standard 12-digit mock e-Way bill number: state code + 10 digits
            const stateCode = this.getStateCode(invoice.organization?.state ?? 'Rajasthan');
            const randomDigits = Math.floor(1000000000 + Math.random() * 9000000000).toString();
            ewbNo = `${stateCode}${randomDigits}`;
        } else {
            const token = await this.authenticate();
            const payload = this.buildEWayBillPayload(invoice, dto, distance);
            try {
                const res = await axios.post(`${this.nicUrl}/ewaybillapi/v1.03/orders`, payload, {
                    headers: { AuthToken: token, 'Content-Type': 'application/json' },
                });
                ewbNo = String(res.data.ewayBillNo || res.data.EwbNo);
            } catch (err) {
                this.logger.error(`E-Way Bill generation failed for ${invoice.invoiceNumber}: ${(err as Error).message}`);
                throw err;
            }
        }

        await this.prisma.invoice.update({
            where: { id: invoiceId },
            data: {
                eWayBillNumber: ewbNo,
            },
        });

        this.logger.log(`E-Way Bill ${ewbNo} generated for invoice ${invoice.invoiceNumber}`);

        return {
            ewayBillNo: ewbNo,
            ewayBillDate: nowIso,
            validUpto,
            vehicleNo: dto.vehicleNo.toUpperCase().trim(),
            fromPlace: invoice.organization?.city || 'Origin',
            toPlace: invoice.customer?.city || 'Destination',
            distance,
            transporterName: dto.transporterName,
        };
    }

    async cancelIRN(irn: string, cancelReason: string): Promise<void> {
        if (!this.isConfigured) {
            this.logger.log(`[E-INVOICE STUB] cancelIRN: ${irn} reason: ${cancelReason}`);
            return;
        }
        const token = await this.authenticate();
        await axios.post(`${this.nicUrl}/eicore/v1.03/Invoice/Cancel`, {
            Irn: irn, CnlRsn: '1', CnlRem: cancelReason,
        }, { headers: { AuthToken: token } });
    }

    async getByIRN(irn: string): Promise<Record<string, unknown>> {
        if (!this.isConfigured) return { irn, status: 'mock' };
        const token = await this.authenticate();
        const res = await axios.get(`${this.nicUrl}/eicore/v1.03/Invoice/irn/${irn}`, {
            headers: { AuthToken: token },
        });
        return res.data;
    }

    private buildEInvoicePayload(invoice: Record<string, unknown>): Record<string, unknown> {
        const org = invoice.organization as Record<string, unknown>;
        const customer = invoice.customer as Record<string, unknown>;
        const items = invoice.items as Array<Record<string, unknown>>;

        return {
            Version: '1.1',
            TranDtls: { TaxSch: 'GST', SupTyp: 'B2B', RegRev: 'N', IgstOnIntra: 'N' },
            DocDtls: {
                Typ: 'INV',
                No: invoice.invoiceNumber,
                Dt: new Date(invoice.invoiceDate as string).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
            },
            SellerDtls: {
                Gstin: (org.gstNumber as string) ?? '',
                LglNm: org.name,
                Addr1: (org.address as string)?.slice(0, 100) ?? '',
                Loc: org.city ?? '',
                Stcd: this.getStateCode(org.state as string) ?? '27',
                Pin: Number(org.pincode) || 400001,
            },
            BuyerDtls: {
                Gstin: (customer.gstNumber as string) ?? 'URP',
                LglNm: customer.name,
                Addr1: ((customer.fullAddress ?? customer.address) as string)?.slice(0, 100) ?? '',
                Loc: customer.city ?? '',
                Stcd: this.getStateCode(customer.state as string) ?? '27',
                Pin: Number(customer.pincode) || 400001,
                Pos: this.getStateCode(customer.state as string) ?? '27',
            },
            ItemList: items.map((item, idx) => ({
                SlNo: String(idx + 1),
                PrdDesc: (item.product as Record<string, unknown>)?.name ?? 'Item',
                IsServc: 'N',
                HsnCd: (item.product as Record<string, unknown>)?.hsnCode ?? (item.hsnCode as string) ?? '0000',
                Qty: Number(item.quantity),
                Unit: item.unit ?? 'NOS',
                UnitPrice: Number(item.price),
                TotAmt: Number(item.taxableAmt ?? item.taxableAmount ?? 0),
                AssAmt: Number(item.taxableAmt ?? item.taxableAmount ?? 0),
                GstRt: Number(item.gstRate),
                CgstAmt: Number(item.cgstAmount ?? 0),
                SgstAmt: Number(item.sgstAmount ?? 0),
                IgstAmt: Number(item.igstAmount ?? 0),
                TotItemVal: Number(item.totalAmount),
            })),
            ValDtls: {
                AssVal: Number(invoice.taxableAmount ?? invoice.totalAmount),
                CgstVal: items.reduce((s: number, i: any) => s + Number(i.cgstAmount ?? 0), 0),
                SgstVal: items.reduce((s: number, i: any) => s + Number(i.sgstAmount ?? 0), 0),
                IgstVal: items.reduce((s: number, i: any) => s + Number(i.igstAmount ?? 0), 0),
                TotInvVal: Number(invoice.totalAmount),
            },
        };
    }

    private buildEWayBillPayload(invoice: Record<string, unknown>, dto: EWayBillInput, distance: number): Record<string, unknown> {
        const org = invoice.organization as Record<string, unknown>;
        const customer = invoice.customer as Record<string, unknown>;
        const items = invoice.items as Array<Record<string, unknown>>;
        const orgStateCode = this.getStateCode(org.state as string);
        const custStateCode = this.getStateCode(customer.state as string);

        return {
            supplyType: 'O',
            subSupplyType: '1',
            docType: 'INV',
            docNo: invoice.invoiceNumber,
            docDate: new Date(invoice.invoiceDate as string).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
            fromGstin: (org.gstNumber as string) ?? 'URP',
            fromTrdName: org.name,
            fromAddr1: (org.address as string)?.slice(0, 100) ?? '',
            fromPlace: org.city ?? 'Origin',
            fromPincode: Number(org.pincode) || 400001,
            actFromStateCode: Number(orgStateCode),
            fromStateCode: Number(orgStateCode),
            toGstin: (customer.gstNumber as string) ?? 'URP',
            toTrdName: customer.name,
            toAddr1: ((customer.fullAddress ?? customer.address) as string)?.slice(0, 100) ?? '',
            toPlace: customer.city ?? 'Destination',
            toPincode: Number(customer.pincode) || 400001,
            actToStateCode: Number(custStateCode),
            toStateCode: Number(custStateCode),
            totalValue: Number(invoice.taxableAmount ?? invoice.totalAmount),
            cgstValue: items.reduce((s: number, i: any) => s + Number(i.cgstAmount ?? 0), 0),
            sgstValue: items.reduce((s: number, i: any) => s + Number(i.sgstAmount ?? 0), 0),
            igstValue: items.reduce((s: number, i: any) => s + Number(i.igstAmount ?? 0), 0),
            cessValue: items.reduce((s: number, i: any) => s + Number(i.cessAmount ?? 0), 0),
            totInvValue: Number(invoice.totalAmount),
            transDistance: String(distance),
            transporterId: dto.transporterId || '',
            transporterName: dto.transporterName || '',
            transDocNo: dto.transportDocNo || '',
            transMode: dto.transportMode === 'RAIL' ? '2' : dto.transportMode === 'AIR' ? '3' : dto.transportMode === 'SHIP' ? '4' : '1',
            vehicleNo: dto.vehicleNo.replace(/[^a-zA-Z0-9]/g, '').toUpperCase(),
            vehicleType: 'R',
            itemList: items.map((item, idx) => ({
                itemNo: idx + 1,
                productName: (item.product as any)?.name ?? 'Item',
                productDesc: (item.product as any)?.name ?? 'Item',
                hsnCode: Number((item.product as any)?.hsnCode || item.hsnCode || 6810),
                quantity: Number(item.quantity),
                qtyUnit: (item.unit as string)?.toUpperCase() ?? 'NOS',
                taxableAmount: Number(item.taxableAmt ?? item.taxableAmount ?? 0),
                cgstRate: Number(item.cgstRate || (item.gstRate ? Number(item.gstRate) / 2 : 0)),
                sgstRate: Number(item.sgstRate || (item.gstRate ? Number(item.gstRate) / 2 : 0)),
                igstRate: Number(item.igstRate || 0),
                cessRate: Number(item.cessRate || 0),
            })),
        };
    }

    public getStateCode(state?: string | null): string {
        const codes: Record<string, string> = {
            'jammu and kashmir': '01', 'himachal pradesh': '02', 'punjab': '03',
            'chandigarh': '04', 'uttarakhand': '05', 'haryana': '06', 'delhi': '07',
            'rajasthan': '08', 'uttar pradesh': '09', 'bihar': '10', 'sikkim': '11',
            'assam': '18', 'west bengal': '19', 'jharkhand': '20', 'odisha': '21',
            'chhattisgarh': '22', 'madhya pradesh': '23', 'gujarat': '24',
            'maharashtra': '27', 'karnataka': '29', 'goa': '30', 'kerala': '32',
            'tamil nadu': '33', 'telangana': '36', 'andhra pradesh': '37',
        };
        return codes[(state ?? '').trim().toLowerCase()] ?? '27';
    }
}
