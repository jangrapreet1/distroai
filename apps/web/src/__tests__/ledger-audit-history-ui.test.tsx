import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TransactionHistoryModal } from "@/app/(dashboard)/customers/[id]/components/transaction-history-modal";
import { CustomerLedgerHistoryDrawer } from "@/app/(dashboard)/customers/[id]/components/customer-ledger-history-drawer";
import { CustomerLedgerTable } from "@/app/(dashboard)/customers/[id]/components/customer-ledger-table";
import { useCustomerLedgerLogs, useCustomerLedger } from "@/hooks/api-hooks";
import type { LedgerEntryWithBalance } from "@/types/customer-transactions";

jest.mock("@/hooks/api-hooks");

describe("Ledger Audit History UI Suite", () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const renderWithClient = (ui: React.ReactElement) =>
    render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);

  const mockTransaction: LedgerEntryWithBalance = {
    id: "tx-100",
    date: "2026-09-20",
    type: "SALE",
    description: "4 Packet Leveler",
    amount: 25000,
    runningBalance: 25000,
    createdAt: "2026-09-20T10:00:00.000Z",
    updatedAt: "2026-09-20T11:00:00.000Z", // 1 hour later -> Edited
    items: [],
  };

  const mockLogs = [
    {
      id: "log-1",
      action: "UPDATE",
      entityType: "CUSTOMER_TRANSACTION",
      entityId: "tx-100",
      createdAt: "2026-10-31T11:30:00.000Z",
      user: { id: "u-1", name: "Preet Distro", email: "preet@example.com" },
      summary: "Amount changed from ₹22,098 to ₹25,000",
      changes: [
        {
          field: "amount",
          label: "Amount",
          oldValue: 22098,
          newValue: 25000,
          description: "Amount changed from ₹22,098 to ₹25,000",
        },
      ],
      transactionSnapshot: {
        date: "2026-09-20",
        type: "SALE",
        amount: 25000,
        description: "4 Packet Leveler",
      },
    },
    {
      id: "log-2",
      action: "DELETE",
      entityType: "CUSTOMER_TRANSACTION",
      entityId: "tx-old",
      createdAt: "2026-10-30T10:00:00.000Z",
      user: { id: "u-1", name: "Preet Distro", email: "preet@example.com" },
      summary: "Deleted Payment of ₹50,000 (Cash received)",
      changes: [],
      transactionSnapshot: {
        type: "PAYMENT",
        amount: 50000,
      },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    (useCustomerLedgerLogs as jest.Mock).mockReturnValue({
      data: { logs: mockLogs, total: mockLogs.length },
      isLoading: false,
      refetch: jest.fn(),
    });

    (useCustomerLedger as jest.Mock).mockReturnValue({
      data: {
        customer: { id: "cust-1", name: "Badal Bhai", outstandingAmount: 25000 },
        summary: {
          totalGoodsGiven: 25000,
          totalGoodsReturned: 0,
          totalPaymentsReceived: 0,
          totalAdjustments: 0,
          netBalance: 25000,
        },
        entries: [mockTransaction],
      },
      isLoading: false,
    });
  });

  describe("1. TransactionHistoryModal", () => {
    it("renders transaction edit history with human-readable before and after values", () => {
      const onClose = jest.fn();
      renderWithClient(
        <TransactionHistoryModal
          open={true}
          onClose={onClose}
          customerId="cust-1"
          transaction={mockTransaction}
        />
      );

      expect(screen.getByText("Transaction Change History")).toBeInTheDocument();
      expect(screen.getAllByText("Preet Distro").length).toBeGreaterThan(0);
      expect(screen.getByText("Amount changed from ₹22,098 to ₹25,000")).toBeInTheDocument();
      expect(screen.getByText("₹22,098")).toBeInTheDocument();
      expect(screen.getByText("₹25,000")).toBeInTheDocument();

      fireEvent.click(screen.getByText("Done"));
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe("2. CustomerLedgerHistoryDrawer", () => {
    it("renders drawer with filter pills and filters between edits and deletions", () => {
      const onClose = jest.fn();
      renderWithClient(
        <CustomerLedgerHistoryDrawer
          open={true}
          onClose={onClose}
          customerId="cust-1"
          customerName="Badal Bhai"
        />
      );

      expect(screen.getByText("Ledger History & Logs")).toBeInTheDocument();
      expect(screen.getByText("All (2)")).toBeInTheDocument();
      expect(screen.getByText("Edits (1)")).toBeInTheDocument();
      expect(screen.getByText("Deletions (1)")).toBeInTheDocument();

      // Click Edits filter
      fireEvent.click(screen.getByText("Edits (1)"));
      expect(screen.getByText("Amount changed from ₹22,098 to ₹25,000")).toBeInTheDocument();
      expect(screen.queryByText("Deleted Payment of ₹50,000 (Cash received)")).not.toBeInTheDocument();

      // Click Deletions filter
      fireEvent.click(screen.getByText("Deletions (1)"));
      expect(screen.getByText("Deleted Payment of ₹50,000 (Cash received)")).toBeInTheDocument();
      expect(screen.queryByText("Amount changed from ₹22,098 to ₹25,000")).not.toBeInTheDocument();

      fireEvent.click(screen.getByText("Close"));
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe("3. CustomerLedgerTable Integration", () => {
    it("displays Edited badge on updated rows and History button in toolbar", () => {
      renderWithClient(
        <CustomerLedgerTable
          customerId="cust-1"
          customerName="Badal Bhai"
          entries={[mockTransaction]}
        />
      );

      // Verify "History" button in toolbar
      expect(screen.getByRole("button", { name: /History/i })).toBeInTheDocument();

      // Verify "Edited" badge exists for mockTransaction (updatedAt > createdAt + 2000)
      const editedBadge = screen.getByText("Edited");
      expect(editedBadge).toBeInTheDocument();

      // Click "Edited" badge -> opens TransactionHistoryModal
      fireEvent.click(editedBadge);
      expect(screen.getByText("Transaction Change History")).toBeInTheDocument();
    });
  });
});
