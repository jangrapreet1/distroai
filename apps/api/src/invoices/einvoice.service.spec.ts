import { EInvoiceService } from './einvoice.service';

describe('EInvoiceService & E-Way Bill Suite', () => {
  let service: EInvoiceService;
  let mockPrisma: any;
  let mockConfig: any;

  beforeEach(() => {
    mockConfig = {
      get: jest.fn((key: string, defaultVal: any) => defaultVal),
    };

    mockPrisma = {
      invoice: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    service = new EInvoiceService(mockConfig, mockPrisma);
  });

  it('maps Indian states to official 2-digit GST state codes', () => {
    expect(service.getStateCode('Rajasthan')).toBe('08');
    expect(service.getStateCode('Maharashtra')).toBe('27');
    expect(service.getStateCode('Delhi')).toBe('07');
    expect(service.getStateCode('Gujarat')).toBe('24');
    expect(service.getStateCode('Karnataka')).toBe('29');
    expect(service.getStateCode('Tamil Nadu')).toBe('33');
    expect(service.getStateCode('Unknown State')).toBe('27'); // Default fallback
  });

  it('generates a valid 12-digit e-Way bill in mock/sandbox mode', async () => {
    mockPrisma.invoice.findUnique.mockResolvedValue({
      id: 'inv-123',
      invoiceNumber: 'INV-2026-009',
      invoiceDate: new Date('2026-04-15'),
      totalAmount: 75000,
      taxableAmount: 63559.32,
      customer: {
        name: 'Sharma Kirana & Hardware',
        gstNumber: '08BBBBB1111B1Z2',
        city: 'Jaipur',
        state: 'Rajasthan',
        pincode: '302001',
      },
      organization: {
        name: 'Radha Kishan Trading Co',
        gstNumber: '08AAAAA0000A1Z5',
        city: 'Bikaner',
        state: 'Rajasthan',
        pincode: '334001',
      },
      items: [
        {
          quantity: 150,
          unit: 'BAG',
          price: 500,
          taxableAmt: 63559.32,
          gstRate: 18,
          cgstAmount: 5720.34,
          sgstAmount: 5720.34,
          totalAmount: 75000,
          product: { name: 'Roff Adhesive', hsnCode: '6810' },
        },
      ],
    });

    mockPrisma.invoice.update.mockResolvedValue({});

    const result = await service.generateEWayBill('inv-123', {
      vehicleNo: 'RJ14-GA-1234',
      transporterName: 'VRL Logistics',
      distanceKm: 320,
    });

    expect(result.ewayBillNo).toBeDefined();
    expect(result.ewayBillNo.length).toBe(12);
    expect(result.ewayBillNo.startsWith('08')).toBe(true); // Rajasthan state code
    expect(result.vehicleNo).toBe('RJ14-GA-1234');
    expect(result.distance).toBe(320);
    expect(result.fromPlace).toBe('Bikaner');
    expect(result.toPlace).toBe('Jaipur');
    expect(result.transporterName).toBe('VRL Logistics');

    // Verify invoice was updated in database
    expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
      where: { id: 'inv-123' },
      data: {
        eWayBillNumber: result.ewayBillNo,
      },
    });
  });

  it('calculates validity based on distance (1 day per 200 km)', async () => {
    mockPrisma.invoice.findUnique.mockResolvedValue({
      id: 'inv-long',
      invoiceNumber: 'INV-2026-010',
      totalAmount: 120000,
      customer: { city: 'Mumbai', state: 'Maharashtra' },
      organization: { city: 'Jaipur', state: 'Rajasthan' },
      items: [],
    });
    mockPrisma.invoice.update.mockResolvedValue({});

    const result = await service.generateEWayBill('inv-long', {
      vehicleNo: 'MH04-AB-9988',
      distanceKm: 1100, // 1100 km -> ceil(1100/200) = 6 days validity
    });

    const now = Date.now();
    const expiry = new Date(result.validUpto).getTime();
    const diffDays = Math.round((expiry - now) / (24 * 3600 * 1000));
    expect(diffDays).toBe(6);
  });
});
