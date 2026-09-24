/**
 * apps/web/src/__tests__/customer-ledger-challenger.test.tsx
 *
 * EMPIRICAL ADVERSARIAL CHALLENGE HARNESS — MILESTONE M3
 * Challenger: challenger_m3_3
 *
 * Rigorous empirical stress-testing of Customer Account Management UI:
 * 1. Extreme monetary figures (crore-scale balances, fractional paise, zero balance transitions, negative Cr formatting).
 * 2. Same-date multiple transaction ordering without aggregation under varied timestamp configurations.
 * 3. Complex Devanagari Hindi typography, multi-word ligatures, line item accordion expansions.
 * 4. Error isolation and state resilience across modals and statement actions.
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import CustomerDetailPage from "@/app/(dashboard)/customers/[id]/page";
import { CustomerLedgerTable } from "@/app/(dashboard)/customers/[id]/components/customer-ledger-table";
import { StatementModal } from "@/app/(dashboard)/customers/[id]/components/statement-modal";
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
import { extractBlobErrorMessage } from "@/lib/statement-actions";
import type { LedgerEntryWithBalance } from "@/types/customer-transactions";

// Mock dependencies
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

describe("Challenger M3_3 Empirical Stress Harness", () => {
  const customerId = "cust-challenger-777";
  const customerName = "लक्ष्मी नारायण मार्बल्स & सन्स (Laxmi Narayan Marbles & Sons)";

  beforeEach(() => {
    jest.clearAllMocks();
    window.URL.createObjectURL = jest.fn().mockReturnValue("blob:http://localhost/challenger-mock-blob");
    window.URL.revokeObjectURL = jest.fn();

    (useCustomerCreditScore as jest.Mock).mockReturnValue({
      data: { score: 92, band: "GREEN", recommendation: "Prime distributor account" },
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
  // SECTION 1: EXTREME AMOUNTS & TRANSITIONS
  // =========================================================================
  describe("1. Extreme Amounts, Fractional Paise & Transitions", () => {
    it("1.1 Handles 99-Crore balance scale with fractional paise (₹99,99,99,999.99) without truncation or scientific notation", () => {
      const croreAmount = 999999999.99;
      (useCustomer as jest.Mock).mockReturnValue({
        data: {
          customer: {
            id: customerId,
            name: customerName,
            tier: "GOLD",
            type: "WHOLESALER",
            outstandingAmount: croreAmount,
          },
          stats: {},
          recentOrders: [],
          recentPayments: [],
        },
        isLoading: false,
      });

      (useCustomerLedger as jest.Mock).mockReturnValue({
        data: {
          customer: { id: customerId, name: customerName, outstandingAmount: croreAmount },
          summary: {
            totalGoodsGiven: 1500000000.00,
            totalGoodsReturned: 200000000.00,
            totalPaymentsReceived: 300000000.01,
            totalAdjustments: 0,
            netBalance: croreAmount,
          },
          entries: [],
        },
        isLoading: false,
      });

      render(<CustomerDetailPage params={{ id: customerId }} />);

      // Verify Indian locale grouping: 99,99,99,999.99
      expect(screen.getByText(/Current Balance: ₹99,99,99,999.99/)).toBeInTheDocument();
      expect(screen.getByText("Dr")).toBeInTheDocument();
      expect(screen.getByText(/DEBIT OUTSTANDING \(बकाया\)/i)).toBeInTheDocument();
    });

    it("1.2 Renders extreme negative balance (-₹45,67,890.12) as advance credit with Cr badge and zero minus signs", () => {
      const negativeBalance = -4567890.12;
      (useCustomer as jest.Mock).mockReturnValue({
        data: {
          customer: {
            id: customerId,
            name: customerName,
            tier: "PLATINUM",
            type: "DISTRIBUTOR",
            outstandingAmount: negativeBalance,
          },
          stats: {},
          recentOrders: [],
          recentPayments: [],
        },
        isLoading: false,
      });

      (useCustomerLedger as jest.Mock).mockReturnValue({
        data: {
          customer: { id: customerId, name: customerName, outstandingAmount: negativeBalance },
          summary: {
            totalGoodsGiven: 1000000.00,
            totalGoodsReturned: 0,
            totalPaymentsReceived: 5567890.12,
            totalAdjustments: 0,
            netBalance: negativeBalance,
          },
          entries: [],
        },
        isLoading: false,
      });

      render(<CustomerDetailPage params={{ id: customerId }} />);

      expect(screen.getByText(/ADVANCE CREDIT \(जमा शेष\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Current Balance: ₹45,67,890.12/)).toBeInTheDocument();
      expect(screen.getByText("Cr")).toBeInTheDocument();

      // Ensure no raw negative signs
      expect(screen.queryByText(/₹-/)).not.toBeInTheDocument();
    });

    it("1.3 Seamlessly transitions through full lifecycle: Debit -> Settled (Nil) -> Advance Credit", () => {
      // Step A: Positive Debit
      const { rerender } = render(<CustomerDetailPage params={{ id: customerId }} />);

      (useCustomer as jest.Mock).mockReturnValue({
        data: {
          customer: { id: customerId, name: customerName, outstandingAmount: 50000 },
          stats: {},
          recentOrders: [],
          recentPayments: [],
        },
        isLoading: false,
      });
      (useCustomerLedger as jest.Mock).mockReturnValue({
        data: {
          summary: { totalGoodsGiven: 50000, totalGoodsReturned: 0, totalPaymentsReceived: 0, totalAdjustments: 0, netBalance: 50000 },
          entries: [],
        },
      });

      rerender(<CustomerDetailPage params={{ id: customerId }} />);
      expect(screen.getByText(/Current Balance: ₹50,000/)).toBeInTheDocument();
      expect(screen.getByText("Dr")).toBeInTheDocument();

      // Step B: Settled (0)
      (useCustomer as jest.Mock).mockReturnValue({
        data: {
          customer: { id: customerId, name: customerName, outstandingAmount: 0 },
          stats: {},
          recentOrders: [],
          recentPayments: [],
        },
        isLoading: false,
      });
      (useCustomerLedger as jest.Mock).mockReturnValue({
        data: {
          summary: { totalGoodsGiven: 50000, totalGoodsReturned: 0, totalPaymentsReceived: 50000, totalAdjustments: 0, netBalance: 0 },
          entries: [],
        },
      });

      rerender(<CustomerDetailPage params={{ id: customerId }} />);
      expect(screen.getByText(/Current Balance: ₹0/)).toBeInTheDocument();
      expect(screen.getByText("Nil")).toBeInTheDocument();
      expect(screen.getByText(/SETTLED \(हिसाब चुकता\)/i)).toBeInTheDocument();

      // Step C: Advance Credit (-15000)
      (useCustomer as jest.Mock).mockReturnValue({
        data: {
          customer: { id: customerId, name: customerName, outstandingAmount: -15000 },
          stats: {},
          recentOrders: [],
          recentPayments: [],
        },
        isLoading: false,
      });
      (useCustomerLedger as jest.Mock).mockReturnValue({
        data: {
          summary: { totalGoodsGiven: 50000, totalGoodsReturned: 0, totalPaymentsReceived: 65000, totalAdjustments: 0, netBalance: -15000 },
          entries: [],
        },
      });

      rerender(<CustomerDetailPage params={{ id: customerId }} />);
      expect(screen.getByText(/Current Balance: ₹15,000/)).toBeInTheDocument();
      expect(screen.getByText("Cr")).toBeInTheDocument();
      expect(screen.getByText(/ADVANCE CREDIT \(जमा शेष\)/i)).toBeInTheDocument();
    });

    it("1.4 Formats fractional paise (₹0.05, ₹12.50) accurately in StatementModal summary box", () => {
      (useCustomerStatement as jest.Mock).mockReturnValue({
        data: {
          organization: { name: "DistroAI Tests", gstin: "08XXXXX1234X1Z0" },
          customer: { id: customerId, name: customerName },
          statementDate: "2026-09-23",
          rows: [],
          summary: {
            totalGoodsGiven: 1000.75,
            totalGoodsReturned: 0.25,
            totalPaymentsReceived: 500.25,
            totalAdjustments: 0.05,
            netBalance: 500.30,
          },
        },
        isLoading: false,
        isFetching: false,
        refetch: jest.fn(),
      });

      render(
        <StatementModal
          open={true}
          onClose={jest.fn()}
          customerId={customerId}
          customerName={customerName}
        />
      );

      expect(screen.getByText(/TOTAL GOODS GIVEN:/)).toBeInTheDocument();
      expect(screen.getByText("₹1,000.75")).toBeInTheDocument();
      expect(screen.getByText("₹500.3")).toBeInTheDocument();
      expect(screen.getByText("Dr")).toBeInTheDocument();
    });
  });

  // =========================================================================
  // SECTION 2: SAME-DATE MULTIPLE TRANSACTIONS & NON-AGGREGATION
  // =========================================================================
  describe("2. Same-Date Multiple Transactions & Non-Aggregation", () => {
    const multiSameDateEntries: LedgerEntryWithBalance[] = [
      {
        id: "tx-m-01",
        date: "2026-09-15",
        createdAt: "2026-09-15T08:00:00Z",
        type: "SALE",
        description: "सुबह की पहली डिलीवरी (Morning Dispatch #1)",
        amount: 25000,
        runningBalance: 25000,
        items: [
          { id: "it-1", productName: "मकराना संगमरमर", quantity: 50, unitPrice: 500, amount: 25000, unit: "वर्ग फुट" },
        ],
      },
      {
        id: "tx-m-02",
        date: "2026-09-15",
        createdAt: "2026-09-15T09:30:00Z",
        type: "PAYMENT",
        description: "बैंक ट्रांसफर (NEFT Payment)",
        amount: 15000,
        runningBalance: 10000,
        paymentMethod: "BANK_TRANSFER",
        reference: "NEFT-998877",
        items: [],
      },
      {
        id: "tx-m-03",
        date: "2026-09-15",
        createdAt: "2026-09-15T11:00:00Z",
        type: "SALE",
        description: "दोपहर की दूसरी डिलीवरी (Noon Dispatch #2)",
        amount: 30000,
        runningBalance: 40000,
        items: [
          { id: "it-2", productName: "राजसमंद व्हाइट मार्बल", quantity: 30, unitPrice: 1000, amount: 30000, unit: "नग" },
        ],
      },
      {
        id: "tx-m-04",
        date: "2026-09-15",
        createdAt: "2026-09-15T14:15:00Z",
        type: "RETURN",
        description: "टूटी टाइलें वापसी (Damaged Tiles Return)",
        amount: 2000,
        runningBalance: 38000,
        items: [
          { id: "it-3", productName: "ग्रेनाइट बॉर्डर", quantity: 4, unitPrice: 500, amount: 2000, unit: "PCS" },
        ],
      },
      {
        id: "tx-m-05",
        date: "2026-09-15",
        createdAt: "2026-09-15T16:00:00Z",
        type: "PAYMENT",
        description: "शाम का नकद भुगतान (Evening Cash)",
        amount: 20000,
        runningBalance: 18000,
        paymentMethod: "CASH",
        reference: "CASH-REC-44",
        items: [],
      },
      {
        id: "tx-m-06",
        date: "2026-09-15",
        createdAt: "2026-09-15T18:00:00Z",
        type: "ADJUSTMENT",
        description: "थोक खरीद पर छूट (Volume Discount Waiver)",
        amount: -500,
        runningBalance: 17500,
        items: [],
      },
    ];

    it("2.1 Renders 6 distinct unaggregated rows for same date in strictly ascending sequence", () => {
      const { container } = render(
        <CustomerLedgerTable
          entries={multiSameDateEntries}
          isLoading={false}
          customerId={customerId}
        />
      );

      const rows = container.querySelectorAll("tbody tr");
      expect(rows.length).toBe(6);

      // Verify chronological sequence by description
      const descElements = screen.getAllByText(/(Morning Dispatch|NEFT Payment|Noon Dispatch|Damaged Tiles|Evening Cash|Volume Discount)/);
      expect(descElements.length).toBe(6);
      expect(descElements[0].textContent).toContain("Morning Dispatch #1");
      expect(descElements[1].textContent).toContain("NEFT Payment");
      expect(descElements[2].textContent).toContain("Noon Dispatch #2");
      expect(descElements[3].textContent).toContain("Damaged Tiles Return");
      expect(descElements[4].textContent).toContain("Evening Cash");
      expect(descElements[5].textContent).toContain("Volume Discount Waiver");
    });

    it("2.2 Correctly reflects running balance progression across 6 same-date transactions", () => {
      render(
        <CustomerLedgerTable
          entries={multiSameDateEntries}
          isLoading={false}
          customerId={customerId}
        />
      );

      // Check running balance milestones
      expect(screen.getByText("₹25,000 Dr")).toBeInTheDocument();
      expect(screen.getByText("₹10,000 Dr")).toBeInTheDocument();
      expect(screen.getByText("₹40,000 Dr")).toBeInTheDocument();
      expect(screen.getByText("₹38,000 Dr")).toBeInTheDocument();
      expect(screen.getByText("₹18,000 Dr")).toBeInTheDocument();
      expect(screen.getByText("₹17,500 Dr")).toBeInTheDocument();
    });
  });

  // =========================================================================
  // SECTION 3: HINDI DEVANAGARI TYPOGRAPHY & EXPANSIONS
  // =========================================================================
  describe("3. Hindi Devanagari Typography & Line Item Expansions", () => {
    const hindiComplexEntries: LedgerEntryWithBalance[] = [
      {
        id: "tx-h-01",
        date: "2026-09-18",
        createdAt: "2026-09-18T10:00:00Z",
        type: "SALE",
        description: "अलमारी के लिए संगमरमर का पत्थर एवं तराशे हुए स्लैब",
        amount: 45000,
        runningBalance: 45000,
        items: [
          {
            id: "it-h1",
            productName: "अलमारी के लिए संगमरमर का पत्थर",
            quantity: 15,
            unitPrice: 2000,
            amount: 30000,
            unit: "नग",
          },
          {
            id: "it-h2",
            productName: "ग्रेनाइट स्लैब (जेट ब्लैक)",
            quantity: 5,
            unitPrice: 3000,
            amount: 15000,
            unit: "वर्ग फुट",
          },
        ],
      },
    ];

    it("3.1 Expands line item accordion and renders Hindi product names, rates, and units accurately", () => {
      render(
        <CustomerLedgerTable
          entries={hindiComplexEntries}
          isLoading={false}
          customerId={customerId}
        />
      );

      // Verify collapsed initial view shows summary preview
      expect(screen.getByText(/अलमारी के लिए संगमरमर का पत्थर एवं तराशे हुए स्लैब/)).toBeInTheDocument();
      expect(screen.getByText("2 items:")).toBeInTheDocument();

      // Click accordion expander button
      const expandBtn = screen.getByRole("button", { name: /2 items:/i });
      fireEvent.click(expandBtn);

      // Expanded sub-table should now show detailed Hindi line items
      expect(screen.getByText("अलमारी के लिए संगमरमर का पत्थर")).toBeInTheDocument();
      expect(screen.getByText("15 नग")).toBeInTheDocument();
      expect(screen.getByText("₹2,000")).toBeInTheDocument();
      expect(screen.getByText("₹30,000")).toBeInTheDocument();

      expect(screen.getByText("ग्रेनाइट स्लैब (जेट ब्लैक)")).toBeInTheDocument();
      expect(screen.getByText("5 वर्ग फुट")).toBeInTheDocument();
      expect(screen.getByText("₹3,000")).toBeInTheDocument();
      expect(screen.getByText("₹15,000")).toBeInTheDocument();

      // Click again to toggle collapse
      fireEvent.click(expandBtn);
      // Detailed rate shouldn't be visible in table body
      expect(screen.queryByText("15 नग")).not.toBeInTheDocument();
    });

    it("3.2 Correctly matches Devanagari Hindi search terms regardless of case or spaces", () => {
      render(
        <CustomerLedgerTable
          entries={hindiComplexEntries}
          isLoading={false}
          customerId={customerId}
        />
      );

      const searchInput = screen.getByPlaceholderText(/search particulars/i);

      // Search matching first item
      fireEvent.change(searchInput, { target: { value: "संगमरमर" } });
      expect(screen.getByText(/अलमारी के लिए संगमरमर का पत्थर एवं तराशे हुए स्लैब/)).toBeInTheDocument();

      // Search non-matching term
      fireEvent.change(searchInput, { target: { value: "लोहा" } });
      expect(screen.getByText(/No ledger transactions found/i)).toBeInTheDocument();

      // Clear search
      fireEvent.change(searchInput, { target: { value: "" } });
      expect(screen.getByText(/अलमारी के लिए संगमरमर का पत्थर एवं तराशे हुए स्लैब/)).toBeInTheDocument();
    });
  });

  // =========================================================================
  // SECTION 4: ERROR HANDLING & BLOB DECODING RESILIENCE
  // =========================================================================
  describe("4. Error Handling & Blob Decoding Resilience", () => {
    it("4.1 Decodes server error message embedded in Blob payload", async () => {
      const serverErrorJson = JSON.stringify({
        error: { message: "Distributor tenant authorization failed: Customer not found" },
      });
      const errorBlob = new Blob([serverErrorJson], { type: "application/json" });

      const axiosError = {
        response: {
          data: errorBlob,
          status: 403,
        },
      };

      const extracted = await extractBlobErrorMessage(axiosError);
      expect(extracted).toBe("Distributor tenant authorization failed: Customer not found");
    });

    it("4.2 Gracefully falls back when blob payload is malformed or unparseable", async () => {
      const corruptBlob = new Blob(["CORRUPTED BINARY NON-JSON"], { type: "text/plain" });

      const axiosError = {
        response: {
          data: corruptBlob,
          status: 500,
        },
      };

      const extracted = await extractBlobErrorMessage(axiosError);
      expect(extracted).toBe("Failed to download statement PDF");
    });
  });
});
