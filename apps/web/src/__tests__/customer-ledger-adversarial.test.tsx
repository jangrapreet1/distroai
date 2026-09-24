/**
 * apps/web/src/__tests__/customer-ledger-adversarial.test.tsx
 *
 * EMPIRICAL ADVERSARIAL CHALLENGE SUITE — MILESTONE M3
 * Challenger 1 (challenger_m3_1)
 *
 * Adversarial stress-testing and boundary verification of Customer Account Management UI:
 * 1. Boundary conditions and extreme values (zero settled, negative credit, 100 Crores high values, sub-paise decimals, form rejections).
 * 2. Same-date chronological sorting with sub-second / millisecond timestamp precision and unaggregated rows.
 * 3. Hindi Devanagari Unicode preservation, complex ligatures, matras, search filtering, and XSS escaping.
 * 4. UI math vs backend calculation parity (zero arithmetic drift, IEEE-754 floating-point stress, reversal impact).
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CustomerDetailPage from "@/app/(dashboard)/customers/[id]/page";
import { CustomerLedgerTable } from "@/app/(dashboard)/customers/[id]/components/customer-ledger-table";
import { CreateTransactionModal } from "@/app/(dashboard)/customers/[id]/components/create-transaction-modal";
import { DeleteTransactionDialog } from "@/app/(dashboard)/customers/[id]/components/delete-transaction-dialog";
import {
  useCustomer,
  useCustomerCreditScore,
  useCustomerActivity,
  useCustomerLedger,
  useCustomerStatement,
  useCreateCustomerTransaction,
  useUpdateCustomerTransaction,
  useDeleteCustomerTransaction,
  useCreateLocationRequest,
  useProducts,
} from "@/hooks/api-hooks";
import { buildStatementPdfFilename } from "@/lib/statement-actions";
import toast from "react-hot-toast";
import type { LedgerEntryWithBalance, CustomerTransactionType } from "@/types/customer-transactions";

// Mock external hooks and libraries
jest.mock("@/hooks/api-hooks");
jest.mock("@/lib/api-client");
jest.mock("react-hot-toast");
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock("next/dynamic", () => () => {
  return function MockDynamicMap() {
    return <div data-testid="mock-map">Map Placeholder</div>;
  };
});

describe("Customer Ledger UI Adversarial Stress & Parity Suite (Milestone M3)", () => {
  const customerId = "cust-adv-999";
  const customerName = "राधेश्याम ट्रेडिंग & संस (Radheshyam Trading & Sons)";

  beforeEach(() => {
    jest.clearAllMocks();
    window.URL.createObjectURL = jest.fn().mockReturnValue("blob:http://localhost/mock-blob-uuid");
    window.URL.revokeObjectURL = jest.fn();

    (useCustomerCreditScore as jest.Mock).mockReturnValue({
      data: { score: 80, band: "GREEN", recommendation: "Good standing" },
      isLoading: false,
    });

    (useCustomerActivity as jest.Mock).mockReturnValue({
      data: { data: [] },
      isLoading: false,
    });

    (useCreateLocationRequest as jest.Mock).mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
    });

    (useProducts as jest.Mock).mockReturnValue({
      data: { data: [] },
      isLoading: false,
    });

    (useCreateCustomerTransaction as jest.Mock).mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
    });

    (useUpdateCustomerTransaction as jest.Mock).mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
    });

    (useDeleteCustomerTransaction as jest.Mock).mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
    });

    (useCustomerLedger as jest.Mock).mockReturnValue({
      data: {
        customer: { id: customerId, name: customerName, outstandingAmount: 0 },
        summary: {
          totalGoodsGiven: 0,
          totalGoodsReturned: 0,
          totalPaymentsReceived: 0,
          totalAdjustments: 0,
          netBalance: 0,
        },
        entries: [],
      },
      isLoading: false,
    });

    (useCustomerStatement as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
      isFetching: false,
      refetch: jest.fn(),
    });
  });

  // =========================================================================
  // 1. BOUNDARY CONDITIONS AND EXTREMES
  // =========================================================================
  describe("1. Boundary Conditions and Extreme Value Handling", () => {
    it("1.1 Zero balance renders 'SETTLED (हिसाब चुकता)' badge, 'Nil' suffix, and ₹0 across all summary widgets", () => {
      (useCustomer as jest.Mock).mockReturnValue({
        data: {
          customer: {
            id: customerId,
            name: customerName,
            tier: "SILVER",
            type: "RETAILER",
            outstandingAmount: 0,
          },
          stats: {},
          recentOrders: [],
          recentPayments: [],
        },
        isLoading: false,
      });

      (useCustomerLedger as jest.Mock).mockReturnValue({
        data: {
          customer: { id: customerId, name: customerName, outstandingAmount: 0 },
          summary: {
            totalGoodsGiven: 50000,
            totalGoodsReturned: 10000,
            totalPaymentsReceived: 40000,
            totalAdjustments: 0,
            netBalance: 0,
          },
          entries: [],
        },
        isLoading: false,
      });

      render(<CustomerDetailPage params={{ id: customerId }} />);

      expect(screen.getByText(/SETTLED \(हिसाब चुकता\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Current Balance: ₹0/)).toBeInTheDocument();
      expect(screen.getByText(/Nil/)).toBeInTheDocument();

      // Sub-stats check
      expect(screen.getByText(/₹50,000/)).toBeInTheDocument();
      expect(screen.getByText(/₹10,000/)).toBeInTheDocument();
      expect(screen.getByText(/₹40,000/)).toBeInTheDocument();
    });

    it("1.2 Negative balance renders 'ADVANCE CREDIT (जमा शेष)' with 'Cr' badge and never renders raw minus sign '₹-'", () => {
      (useCustomer as jest.Mock).mockReturnValue({
        data: {
          customer: {
            id: customerId,
            name: customerName,
            tier: "GOLD",
            type: "WHOLESALER",
            outstandingAmount: -98765.43,
          },
          stats: {},
          recentOrders: [],
          recentPayments: [],
        },
        isLoading: false,
      });

      (useCustomerLedger as jest.Mock).mockReturnValue({
        data: {
          summary: {
            totalGoodsGiven: 10000,
            totalGoodsReturned: 0,
            totalPaymentsReceived: 108765.43,
            totalAdjustments: 0,
            netBalance: -98765.43,
          },
          entries: [],
        },
      });

      render(<CustomerDetailPage params={{ id: customerId }} />);

      expect(screen.getByText(/ADVANCE CREDIT \(जमा शेष\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Current Balance: ₹98,765.43/)).toBeInTheDocument();
      expect(screen.getByText("Cr")).toBeInTheDocument();

      // Assert no raw negative sign formatting exists in DOM
      expect(screen.queryByText(/₹-98,765/)).not.toBeInTheDocument();
      expect(screen.queryByText(/₹ -/)).not.toBeInTheDocument();
    });

    it("1.3 Extreme high values (₹1,00,00,00,000 / 100 Crores) format accurately with Indian separators without overflow or scientific notation", () => {
      (useCustomer as jest.Mock).mockReturnValue({
        data: {
          customer: {
            id: customerId,
            name: customerName,
            tier: "GOLD",
            type: "DISTRIBUTOR",
            outstandingAmount: 1000000000.5, // 100 Crores + 50 paise
          },
          stats: {},
          recentOrders: [],
          recentPayments: [],
        },
        isLoading: false,
      });

      (useCustomerLedger as jest.Mock).mockReturnValue({
        data: {
          summary: {
            totalGoodsGiven: 2500000000,
            totalGoodsReturned: 500000000,
            totalPaymentsReceived: 1000000000,
            totalAdjustments: 500000.5,
            netBalance: 1000000000.5,
          },
          entries: [],
        },
      });

      render(<CustomerDetailPage params={{ id: customerId }} />);

      // Formatted in Indian numbering system: 1,00,00,00,000.5
      expect(screen.getByText(/Current Balance: ₹1,00,00,00,000.5/)).toBeInTheDocument();
      expect(screen.getByText("Dr")).toBeInTheDocument();
      expect(screen.queryByText(/1e\+/i)).not.toBeInTheDocument(); // No scientific notation
    });

    it("1.4 Sub-paise inputs in CreateTransactionModal are cleanly rounded to 2 decimal places before submission", async () => {
      const onSubmit = jest.fn();
      render(
        <CreateTransactionModal
          open={true}
          onClose={jest.fn()}
          customerId={customerId}
          customerName={customerName}
          defaultType="SALE"
          onSubmit={onSubmit}
        />
      );

      // Enter fractional quantity 3.333 and unit price 10.005
      const itemInput = screen.getByPlaceholderText(/item name/i);
      fireEvent.change(itemInput, { target: { value: "रेती / बजरी (Sand)" } });

      const qtyInput = screen.getByPlaceholderText(/qty/i);
      fireEvent.change(qtyInput, { target: { value: "3.333" } });

      const rateInput = screen.getByPlaceholderText(/rate/i);
      fireEvent.change(rateInput, { target: { value: "10.005" } });

      // 3.333 * 10.005 = 33.346665 -> rounded to 33.35
      const submitBtn = screen.getByRole("button", { name: /save transaction/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1);
        const payload = onSubmit.mock.calls[0][0];
        expect(payload.amount).toBe(33.35);
        expect(payload.items[0].amount).toBe(33.35);
      });
    });

    it("1.5 Blocks 0 or invalid submissions across all 4 transaction types with toast error", async () => {
      const onSubmit = jest.fn();

      // Case A: SALE with 0 amount
      const { unmount: unmountSale } = render(
        <CreateTransactionModal
          open={true}
          onClose={jest.fn()}
          customerId={customerId}
          customerName={customerName}
          defaultType="SALE"
          onSubmit={onSubmit}
        />
      );

      const saleSubmitBtn = screen.getByRole("button", { name: /save transaction/i });
      fireEvent.click(saleSubmitBtn);
      expect(onSubmit).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith("Please enter at least one line item or a valid sale amount");
      unmountSale();

      // Case B: RETURN with 0 amount (Lump Sum)
      const { unmount: unmountReturn } = render(
        <CreateTransactionModal
          open={true}
          onClose={jest.fn()}
          customerId={customerId}
          customerName={customerName}
          defaultType="RETURN"
          onSubmit={onSubmit}
        />
      );
      const lumpSumBtn = screen.getByRole("button", { name: /lump sum amount/i });
      fireEvent.click(lumpSumBtn);
      const returnAmountInput = screen.getByPlaceholderText(/e\.g\. 5000/i);
      fireEvent.change(returnAmountInput, { target: { value: "0" } });
      const returnSubmit = screen.getByRole("button", { name: /save transaction/i });
      const returnForm = returnSubmit.closest("form")!;
      fireEvent.submit(returnForm);
      expect(onSubmit).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith("Please enter a valid return amount");
      unmountReturn();

      // Case C: PAYMENT with 0 amount
      const { unmount: unmountPayment } = render(
        <CreateTransactionModal
          open={true}
          onClose={jest.fn()}
          customerId={customerId}
          customerName={customerName}
          defaultType="PAYMENT"
          onSubmit={onSubmit}
        />
      );
      const payAmountInput = screen.getByPlaceholderText(/amount \(₹\)/i);
      fireEvent.change(payAmountInput, { target: { value: "0" } });
      const paySubmit = screen.getByRole("button", { name: /save transaction/i });
      const payForm = paySubmit.closest("form")!;
      fireEvent.submit(payForm);
      expect(onSubmit).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith("Please enter a valid payment amount");
      unmountPayment();

      // Case D: ADJUSTMENT with 0 amount
      render(
        <CreateTransactionModal
          open={true}
          onClose={jest.fn()}
          customerId={customerId}
          customerName={customerName}
          defaultType="ADJUSTMENT"
          onSubmit={onSubmit}
        />
      );
      const adjAmountInput = screen.getByPlaceholderText("0.00");
      fireEvent.change(adjAmountInput, { target: { value: "0" } });
      const adjSubmit = screen.getByRole("button", { name: /save transaction/i });
      const adjForm = adjSubmit.closest("form")!;
      fireEvent.submit(adjForm);
      expect(onSubmit).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith("Please enter a valid non-zero adjustment amount");
    });

    it("1.6 Normalizes negative adjustment amount inputs and respects direction toggle", async () => {
      const onSubmit = jest.fn();

      // Test Credit / Discount (-) default
      const { unmount } = render(
        <CreateTransactionModal
          open={true}
          onClose={jest.fn()}
          customerId={customerId}
          customerName={customerName}
          defaultType="ADJUSTMENT"
          onSubmit={onSubmit}
        />
      );

      const adjInput = screen.getByPlaceholderText("0.00");
      fireEvent.change(adjInput, { target: { value: "500" } });
      const saveBtn = screen.getByRole("button", { name: /save transaction/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "ADJUSTMENT",
            amount: -500, // Credit produces negative balance adjustment
          })
        );
      });
      unmount();

      onSubmit.mockClear();

      // Test Debit / Charge (+) toggle
      render(
        <CreateTransactionModal
          open={true}
          onClose={jest.fn()}
          customerId={customerId}
          customerName={customerName}
          defaultType="ADJUSTMENT"
          onSubmit={onSubmit}
        />
      );
      const debitBtn = screen.getByRole("button", { name: /debit \/ charge/i });
      fireEvent.click(debitBtn);
      const adjInput2 = screen.getByPlaceholderText("0.00");
      fireEvent.change(adjInput2, { target: { value: "750" } });
      const saveBtn2 = screen.getByRole("button", { name: /save transaction/i });
      fireEvent.click(saveBtn2);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "ADJUSTMENT",
            amount: 750, // Debit produces positive balance adjustment
          })
        );
      });
    });
  });

  // =========================================================================
  // 2. SAME-DATE SORTING WITH TIMESTAMP PRECISION & UNAGGREGATED ROWS
  // =========================================================================
  describe("2. Same-Date Sorting with Timestamp Precision and Unaggregated Rows", () => {
    const sameDateEntries: LedgerEntryWithBalance[] = [
      {
        id: "tx-3-pay",
        date: "2026-08-01",
        createdAt: "2026-08-01T10:00:00.450Z",
        type: "PAYMENT",
        description: "तीसरी प्रविष्टि (Third entry: Afternoon UPI payment)",
        amount: 3000,
        runningBalance: 9000,
        paymentMethod: "UPI",
        reference: "UPI/ADV-3",
        items: [],
      },
      {
        id: "tx-1-sale",
        date: "2026-08-01",
        createdAt: "2026-08-01T10:00:00.050Z",
        type: "SALE",
        description: "पहली प्रविष्टि (First entry: Morning delivery)",
        amount: 15000,
        runningBalance: 15000,
        items: [
          { id: "i1", productName: "अलमारी के लिए पत्थर", quantity: 10, unitPrice: 1500, amount: 15000, unit: "नग" },
        ],
      },
      {
        id: "tx-4-ret",
        date: "2026-08-01",
        createdAt: "2026-08-01T10:00:00.890Z",
        type: "RETURN",
        description: "चौथी प्रविष्टि (Fourth entry: Evening return)",
        amount: 1000,
        runningBalance: 8000,
        items: [
          { id: "i2", productName: "टूटा पत्थर", quantity: 1, unitPrice: 1000, amount: 1000, unit: "नग" },
        ],
      },
      {
        id: "tx-2-sale",
        date: "2026-08-01",
        createdAt: "2026-08-01T10:00:00.120Z",
        type: "SALE",
        description: "दूसरी प्रविष्टि (Second entry: Noon rebar dispatch)",
        amount: 5000,
        runningBalance: 12000,
        items: [],
      },
      {
        id: "tx-5-adj",
        date: "2026-08-01",
        createdAt: "2026-08-01T10:00:00.890Z", // Identical millisecond timestamp as tx-4, tie breaker by id
        type: "ADJUSTMENT",
        description: "पांचवीं प्रविष्टि (Fifth entry: Closing roundoff waiver)",
        amount: -100,
        runningBalance: 7900,
        items: [],
      },
    ];

    it("2.1 Orders same-date transactions with sub-second millisecond precision and deterministic ID tie-breaking", () => {
      // Pass raw entries in randomized / reversed order
      render(
        <CustomerLedgerTable
          entries={sameDateEntries}
          isLoading={false}
          customerId={customerId}
        />
      );

      // Verify all 5 entries render in ascending chronological order:
      // 1. tx-1-sale (.050Z)
      // 2. tx-2-sale (.120Z)
      // 3. tx-3-pay  (.450Z)
      // 4. tx-4-ret  (.890Z, id 'tx-4-ret')
      // 5. tx-5-adj  (.890Z, id 'tx-5-adj')
      const descriptions = screen.getAllByText(/प्रविष्टि/);
      expect(descriptions.length).toBe(5);
      expect(descriptions[0].textContent).toContain("पहली प्रविष्टि");
      expect(descriptions[1].textContent).toContain("दूसरी प्रविष्टि");
      expect(descriptions[2].textContent).toContain("तीसरी प्रविष्टि");
      expect(descriptions[3].textContent).toContain("चौथी प्रविष्टि");
      expect(descriptions[4].textContent).toContain("पांचवीं प्रविष्टि");
    });

    it("2.2 Unaggregated rows invariant: renders 5 distinct table rows without collapsing same-date transactions", () => {
      const { container } = render(
        <CustomerLedgerTable
          entries={sameDateEntries}
          isLoading={false}
          customerId={customerId}
        />
      );

      // Query table body rows
      const tbody = container.querySelector("tbody");
      expect(tbody).not.toBeNull();
      const rows = tbody?.querySelectorAll("tr");
      expect(rows?.length).toBe(5);

      // Verify each row has distinct debits/credits and running balance
      expect(screen.getByText("₹15,000 Dr")).toBeInTheDocument();
      expect(screen.getByText("₹12,000 Dr")).toBeInTheDocument();
      expect(screen.getByText("₹9,000 Dr")).toBeInTheDocument();
      expect(screen.getByText("₹8,000 Dr")).toBeInTheDocument();
      expect(screen.getByText("₹7,900 Dr")).toBeInTheDocument();
    });

    it("2.3 Correctly segregates debits and credits for all same-date entries", () => {
      render(
        <CustomerLedgerTable
          entries={sameDateEntries}
          isLoading={false}
          customerId={customerId}
        />
      );

      // SALE: ₹15,000 in Debit column
      // SALE: ₹5,000 in Debit column
      // PAYMENT: ₹3,000 in Credit column
      // RETURN: ₹1,000 in Credit column
      // ADJUSTMENT (-100): ₹100 in Credit column
      expect(screen.getAllByText("₹15,000").length).toBeGreaterThan(0);
      expect(screen.getAllByText("₹5,000").length).toBeGreaterThan(0);
      expect(screen.getAllByText("₹3,000").length).toBeGreaterThan(0);
      expect(screen.getAllByText("₹1,000").length).toBeGreaterThan(0);
      expect(screen.getAllByText("₹100").length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 3. HINDI DEVANAGARI TEXT PRESERVATION & ESCAPING
  // =========================================================================
  describe("3. Hindi Devanagari Text Preservation and Escaping", () => {
    const hindiEntries: LedgerEntryWithBalance[] = [
      {
        id: "tx-hindi-1",
        date: "2026-08-10",
        createdAt: "2026-08-10T10:00:00Z",
        type: "SALE",
        description: "अलमारी के लिए पत्थर व ग्रेनाइट स्लैब (काला)",
        amount: 25000,
        runningBalance: 25000,
        items: [
          {
            id: "h-item-1",
            productName: "अलमारी के लिए पत्थर",
            quantity: 10,
            unitPrice: 1500,
            amount: 15000,
            unit: "नग",
          },
          {
            id: "h-item-2",
            productName: "ग्रेनाइट स्लैब (काला)",
            quantity: 5,
            unitPrice: 2000,
            amount: 10000,
            unit: "वर्ग फुट",
          },
        ],
      },
      {
        id: "tx-hindi-2",
        date: "2026-08-11",
        createdAt: "2026-08-11T12:00:00Z",
        type: "PAYMENT",
        description: "दुकान पर नकद जमा — रसीद सं. १०५२",
        amount: 15000,
        runningBalance: 10000,
        paymentMethod: "CASH",
        reference: "रसीद-१०५२",
        items: [],
      },
      {
        id: "tx-xss-1",
        date: "2026-08-12",
        createdAt: "2026-08-12T14:00:00Z",
        type: "SALE",
        description: "<script>alert('XSS')</script> अलमारी का काम",
        amount: 5000,
        runningBalance: 15000,
        items: [
          {
            id: "xss-item",
            productName: "<img src=x onerror=alert(1)> मार्बल",
            quantity: 2,
            unitPrice: 2500,
            amount: 5000,
            unit: "PCS",
          },
        ],
      },
    ];

    it("3.1 Renders Hindi Devanagari text, conjuncts, and vernacular units accurately without corruption", () => {
      render(
        <CustomerLedgerTable
          entries={hindiEntries}
          isLoading={false}
          customerId={customerId}
        />
      );

      // Verify Hindi descriptions
      expect(screen.getByText(/अलमारी के लिए पत्थर व ग्रेनाइट स्लैब \(काला\)/)).toBeInTheDocument();
      expect(screen.getByText(/दुकान पर नकद जमा — रसीद सं\. १०५२/)).toBeInTheDocument();
      expect(screen.getByText(/रसीद-१०५२/)).toBeInTheDocument();

      // Expand line items accordion
      const expandBtn = screen.getByRole("button", { name: /अलमारी के लिए पत्थर/ });
      fireEvent.click(expandBtn);

      // Vernacular units rendered
      expect(screen.getByText("10 नग")).toBeInTheDocument();
      expect(screen.getByText("5 वर्ग फुट")).toBeInTheDocument();
    });

    it("3.2 Filters ledger transactions by typing Hindi search keywords", () => {
      render(
        <CustomerLedgerTable
          entries={hindiEntries}
          isLoading={false}
          customerId={customerId}
        />
      );

      const searchInput = screen.getByPlaceholderText(/search particulars/i);

      // Search for "ग्रेनाइट"
      fireEvent.change(searchInput, { target: { value: "ग्रेनाइट" } });
      expect(screen.getByText(/अलमारी के लिए पत्थर व ग्रेनाइट स्लैब/)).toBeInTheDocument();
      expect(screen.queryByText(/दुकान पर नकद जमा/)).not.toBeInTheDocument();

      // Search for "नकद"
      fireEvent.change(searchInput, { target: { value: "नकद" } });
      expect(screen.getByText(/दुकान पर नकद जमा/)).toBeInTheDocument();
      expect(screen.queryByText(/अलमारी के लिए पत्थर व ग्रेनाइट स्लैब/)).not.toBeInTheDocument();
    });

    it("3.3 Neutralizes XSS script injections in transaction descriptions and line items", () => {
      const { container } = render(
        <CustomerLedgerTable
          entries={hindiEntries}
          isLoading={false}
          customerId={customerId}
        />
      );

      // React escapes strings into safe text nodes
      expect(screen.getByText(/<script>alert\('XSS'\)<\/script>/)).toBeInTheDocument();
      expect(screen.getByText(/<img src=x onerror=alert\(1\)> मार्बल/)).toBeInTheDocument();

      // Assert no actual <script> or <img> tags were injected into the DOM
      expect(container.querySelectorAll("script").length).toBe(0);
      expect(container.querySelectorAll("img").length).toBe(0);
    });

    it("3.4 buildStatementPdfFilename preserves Hindi Unicode and strips illegal path characters", () => {
      const filename1 = buildStatementPdfFilename("राधेश्याम किराना & संस / दिल्ली", "2026-09-23");
      expect(filename1).toBe("RTK-Statement-राधेश्याम-किराना-&-संस-दिल्ली-2026-09-23.pdf");
      expect(filename1).not.toContain("/");
      expect(filename1).not.toContain("\\");

      // Boundary: string containing only illegal path characters falls back safely
      const filenameFallback = buildStatementPdfFilename("///\\\\::**??\"\"<<>>||");
      expect(filenameFallback).toContain("RTK-Statement-Customer-");
    });
  });

  // =========================================================================
  // 4. UI MATH VS BACKEND CALCULATION PARITY
  // =========================================================================
  describe("4. UI Math vs Backend Calculation Parity", () => {
    it("4.1 Running balances across a 10-transaction lifecycle match pure double-entry accounting invariants", () => {
      // Setup a simulated transaction sequence
      const transactions: Array<{
        id: string;
        date: string;
        type: CustomerTransactionType;
        amount: number;
        desc: string;
      }> = [
        { id: "t1", date: "2026-09-01", type: "SALE", amount: 10000, desc: "Sale 1" },
        { id: "t2", date: "2026-09-02", type: "PAYMENT", amount: 4000, desc: "Pay 1" },
        { id: "t3", date: "2026-09-03", type: "RETURN", amount: 1500, desc: "Return 1" },
        { id: "t4", date: "2026-09-04", type: "ADJUSTMENT", amount: -500, desc: "Discount 1" },
        { id: "t5", date: "2026-09-05", type: "SALE", amount: 20000, desc: "Sale 2" },
        { id: "t6", date: "2026-09-06", type: "PAYMENT", amount: 15000, desc: "Pay 2" },
        { id: "t7", date: "2026-09-07", type: "ADJUSTMENT", amount: 250, desc: "Interest charge" },
        { id: "t8", date: "2026-09-08", type: "RETURN", amount: 800, desc: "Return 2" },
        { id: "t9", date: "2026-09-09", type: "PAYMENT", amount: 5000, desc: "Pay 3" },
        { id: "t10", date: "2026-09-10", type: "PAYMENT", amount: 4000, desc: "Pay 4 (Advance credit)" },
      ];

      // Calculate running balances using standard double-entry rules
      let currentBal = 0;
      let totalGoodsGiven = 0;
      let totalGoodsReturned = 0;
      let totalPaymentsReceived = 0;
      let totalAdjustments = 0;

      const entriesWithBalance: LedgerEntryWithBalance[] = transactions.map((tx, idx) => {
        if (tx.type === "SALE") {
          totalGoodsGiven += tx.amount;
          currentBal += tx.amount;
        } else if (tx.type === "RETURN") {
          totalGoodsReturned += tx.amount;
          currentBal -= tx.amount;
        } else if (tx.type === "PAYMENT") {
          totalPaymentsReceived += tx.amount;
          currentBal -= tx.amount;
        } else if (tx.type === "ADJUSTMENT") {
          totalAdjustments += tx.amount;
          currentBal += tx.amount;
        }

        return {
          id: tx.id,
          date: tx.date,
          createdAt: `2026-09-0${idx + 1}T10:00:00Z`,
          type: tx.type,
          description: tx.desc,
          amount: Math.abs(tx.amount),
          runningBalance: currentBal,
          items: [],
        };
      });

      // Assert cumulative accounting invariants
      expect(totalGoodsGiven).toBe(30000);
      expect(totalGoodsReturned).toBe(2300);
      expect(totalPaymentsReceived).toBe(28000);
      expect(totalAdjustments).toBe(-250);
      // Net Balance = 30000 - 2300 - 28000 + (-250) = -550 (Advance Credit)
      expect(currentBal).toBe(-550);

      // Render table with calculated entries
      render(
        <CustomerLedgerTable
          entries={entriesWithBalance}
          isLoading={false}
          customerId={customerId}
        />
      );

      // Final row running balance is ₹550 Cr
      expect(screen.getByText("₹550 Cr")).toBeInTheDocument();
      // Intermediate balances
      expect(screen.getByText("₹10,000 Dr")).toBeInTheDocument();
      expect(screen.getByText("₹6,000 Dr")).toBeInTheDocument();
      expect(screen.getByText("₹4,500 Dr")).toBeInTheDocument();
      expect(screen.getByText("₹4,000 Dr")).toBeInTheDocument();
      expect(screen.getByText("₹24,000 Dr")).toBeInTheDocument();
      expect(screen.getByText("₹9,000 Dr")).toBeInTheDocument();
      expect(screen.getByText("₹9,250 Dr")).toBeInTheDocument();
      expect(screen.getByText("₹8,450 Dr")).toBeInTheDocument();
      expect(screen.getByText("₹3,450 Dr")).toBeInTheDocument();
    });

    it("4.2 Zero IEEE-754 floating-point drift over multi-item decimals", async () => {
      const onSubmit = jest.fn();

      render(
        <CreateTransactionModal
          open={true}
          onClose={jest.fn()}
          customerId={customerId}
          customerName={customerName}
          defaultType="SALE"
          onSubmit={onSubmit}
        />
      );

      // Add multiple decimal line items:
      // Item 1: 0.1 * 3 = 0.3
      // Item 2: 0.2 * 3 = 0.6
      // In naive JS: 0.1 + 0.2 = 0.30000000000000004
      const nameInput = screen.getByPlaceholderText(/item name/i);
      fireEvent.change(nameInput, { target: { value: "Item A" } });
      const qtyInput = screen.getByPlaceholderText(/qty/i);
      fireEvent.change(qtyInput, { target: { value: "3" } });
      const rateInput = screen.getByPlaceholderText(/rate/i);
      fireEvent.change(rateInput, { target: { value: "0.1" } });

      const addRowBtn = screen.getByRole("button", { name: /add row/i });
      fireEvent.click(addRowBtn);

      const allNameInputs = screen.getAllByPlaceholderText(/item name/i);
      fireEvent.change(allNameInputs[1], { target: { value: "Item B" } });
      const allQtyInputs = screen.getAllByPlaceholderText(/qty/i);
      fireEvent.change(allQtyInputs[1], { target: { value: "3" } });
      const allRateInputs = screen.getAllByPlaceholderText(/rate/i);
      fireEvent.change(allRateInputs[1], { target: { value: "0.2" } });

      const submitBtn = screen.getByRole("button", { name: /save transaction/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1);
        const payload = onSubmit.mock.calls[0][0];
        // 0.3 + 0.6 = 0.9 (strictly without binary float drift)
        expect(payload.amount).toBe(0.9);
      });
    });

    it("4.3 DeleteTransactionDialog accurately explains financial balance reversal impact", () => {
      const saleTx: LedgerEntryWithBalance = {
        id: "tx-rev-1",
        date: "2026-09-15",
        type: "SALE",
        amount: 14500,
        runningBalance: 20000,
        description: "Sale reversal test",
        createdAt: "2026-09-15T10:00:00Z",
        items: [],
      };

      const { rerender } = render(
        <DeleteTransactionDialog
          open={true}
          onClose={jest.fn()}
          customerId={customerId}
          customerName="Manish"
          transaction={saleTx}
        />
      );

      // Deleting a SALE decreases customer balance
      expect(
        screen.getByText(/deleting this sale will decrease manish's outstanding balance by ₹14,500/i)
      ).toBeInTheDocument();

      // Deleting a PAYMENT increases customer balance
      const payTx: LedgerEntryWithBalance = {
        id: "tx-rev-2",
        date: "2026-09-15",
        type: "PAYMENT",
        amount: 8000,
        runningBalance: 12000,
        description: "Pay reversal test",
        createdAt: "2026-09-15T11:00:00Z",
        items: [],
      };

      rerender(
        <DeleteTransactionDialog
          open={true}
          onClose={jest.fn()}
          customerId={customerId}
          customerName="Manish"
          transaction={payTx}
        />
      );

      expect(
        screen.getByText(/deleting this payment will increase manish's outstanding balance by ₹8,000/i)
      ).toBeInTheDocument();
    });
  });
});
