import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';

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
            this.logger.warn('NIC E-Invoice not configured — will return mock responses');
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
                ackNo: `ACK${Date.now()}`,
                ackDate: new Date().toISOString(),
                signedQRCode: 'mock-qr-code',
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
        const org = invoice.org as Record<string, unknown>;
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
                Gstin: org.gstin ?? '', LglNm: org.name,
                Addr1: (org.address as string)?.slice(0, 100) ?? '',
                Loc: org.city ?? '', Stcd: this.getStateCode(org.state as string) ?? '27',
                Pin: Number(org.pincode) || 400001,
            },
            BuyerDtls: {
                Gstin: customer.gstin ?? 'URP', LglNm: customer.name,
                Addr1: (customer.address as string)?.slice(0, 100) ?? '',
                Loc: customer.city ?? '', Stcd: this.getStateCode(customer.state as string) ?? '27',
                Pin: Number(customer.pincode) || 400001, Pos: this.getStateCode(customer.state as string) ?? '27',
            },
            ItemList: items.map((item, idx) => ({
                SlNo: String(idx + 1),
                PrdDesc: (item.product as Record<string, unknown>)?.name ?? 'Item',
                IsServc: 'N',
                HsnCd: (item.product as Record<string, unknown>)?.hsnCode ?? '0000',
                Qty: Number(item.quantity),
                Unit: item.unit ?? 'NOS',
                UnitPrice: Number(item.price),
                TotAmt: Number(item.taxableAmount),
                AssAmt: Number(item.taxableAmount),
                GstRt: Number(item.gstRate),
                CgstAmt: Number(item.cgstAmount),
                SgstAmt: Number(item.sgstAmount),
                IgstAmt: Number(item.igstAmount),
                TotItemVal: Number(item.totalAmount),
            })),
            ValDtls: {
                AssVal: Number(invoice.totalAmount),
                CgstVal: items.reduce((s: number, i: any) => s + Number(i.cgstAmount), 0),
                SgstVal: items.reduce((s: number, i: any) => s + Number(i.sgstAmount), 0),
                IgstVal: items.reduce((s: number, i: any) => s + Number(i.igstAmount), 0),
                TotInvVal: Number(invoice.netAmount),
            },
        };
    }

    private getStateCode(state: string): string {
        const codes: Record<string, string> = {
            'maharashtra': '27', 'delhi': '07', 'karnataka': '29', 'tamil nadu': '33',
            'gujarat': '24', 'rajasthan': '08', 'uttar pradesh': '09', 'west bengal': '19',
            'telangana': '36', 'andhra pradesh': '37', 'kerala': '32', 'madhya pradesh': '23',
            'punjab': '03', 'haryana': '06', 'bihar': '10', 'odisha': '21',
            'jharkhand': '20', 'chhattisgarh': '22', 'assam': '18', 'goa': '30',
        };
        return codes[(state ?? '').toLowerCase()] ?? '27';
    }
}
