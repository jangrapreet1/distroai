import React from "react";
import { render, screen, fireEvent, waitFor, renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CustomerDetailPage from "@/app/(dashboard)/customers/[id]/page";
import { CustomerLedgerTable } from "@/app/(dashboard)/customers/[id]/components/customer-ledger-table";
import { CreateTransactionModal } from "@/app/(dashboard)/customers/[id]/components/create-transaction-modal";
import { EditTransactionModal } from "@/app/(dashboard)/customers/[id]/components/edit-transaction-modal";
import { DeleteTransactionDialog } from "@/app/(dashboard)/customers/[id]/components/delete-transaction-dialog";
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
import {
  downloadCustomerStatementPdf,
  printCustomerStatement,
  buildStatementPdfFilename,
  extractBlobErrorMessage,
} from "@/lib/statement-actions";
import apiClient, { getApiError } from "@/lib/api-client";
import toast from "react-hot-toast";
import type { LedgerEntryWithBalance } from "@/types/customer-transactions";

// Mock dependencies
jest.mock("@/hooks/api-hooks");
jest.mock("@/lib/api-client");
jest.mock("react-hot-toast");
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock("next/dynamic", () => () => {
  return function MockDynamicComponent() {
    return <div data-testid="mock-dynamic">Map</div>;
  };
});

describe("Customer Ledger UI & Account Management Suite (Milestone M3)", () => {
  const customerId = "cust-123";
  const customerName = "Manish Enterprises";

  beforeEach(() => {
    jest.clearAllMocks();
    window.URL.createObjectURL = jest.fn().mockReturnValue("blob:http://localhost/test-blob-uuid");
    window.URL.revokeObjectURL = jest.fn();

    // Default mock hook returns
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
  // 1. Balance Rendering with Rupee Symbol ₹ and Visual Status
  // =========================================================================
  describe("1. Balance Rendering with Rupee Symbol ₹", () => {
    it("renders positive debit balance prominently with Rupee symbol ₹ and Dr indicator", () => {
      (useCustomer as jest.Mock).mockReturnValue({
        data: {
          customer: {
            id: customerId,
            name: customerName,
            phone: "+919876543210",
            tier: "GOLD",
            type: "RETAILER",
            outstandingAmount: 45200.5,
            creditLimit: 100000,
            creditDays: 30,
          },
          stats: { totalRevenue: 150000, totalOrders: 12, avgOrderValue: 12500 },
          recentOrders: [],
          recentPayments: [],
        },
        isLoading: false,
      });

      (useCustomerCreditScore as jest.Mock).mockReturnValue({
        data: { score: 85, band: "GREEN", recommendation: "Eligible for credit" },
      });
      (useCustomerActivity as jest.Mock).mockReturnValue({
        data: { data: [] },
        isLoading: false,
      });
      (useCustomerLedger as jest.Mock).mockReturnValue({
        data: {
          customer: { id: customerId, name: customerName, outstandingAmount: 45200.5 },
          summary: {
            totalGoodsGiven: 120500,
            totalGoodsReturned: 8300,
            totalPaymentsReceived: 67000,
            totalAdjustments: 0,
            netBalance: 45200.5,
          },
          entries: [],
        },
        isLoading: false,
      });

      render(<CustomerDetailPage params={{ id: customerId }} />);

      // Verify customer name
      expect(screen.getByText(customerName)).toBeInTheDocument();

      // Verify prominent Current Balance displays formatted with ₹
      const balanceElements = screen.getAllByText(/₹45,200/);
      expect(balanceElements.length).toBeGreaterThan(0);
      expect(balanceElements[0].textContent).toContain("₹");

      // Verify status label
      expect(screen.getAllByText(/DEBIT OUTSTANDING/i).length).toBeGreaterThan(0);

      // Verify sub-stat chips format with Rupee symbol ₹
      expect(screen.getByText(/₹1,20,500/)).toBeInTheDocument(); // Goods Given
      expect(screen.getByText(/₹8,300/)).toBeInTheDocument(); // Goods Returned
      expect(screen.getByText(/₹67,000/)).toBeInTheDocument(); // Payments Received
    });

    it("renders negative advance credit balance with Cr indicator and green status", () => {
      (useCustomer as jest.Mock).mockReturnValue({
        data: {
          customer: {
            id: customerId,
            name: "Radhakishan Advance Account",
            tier: "GOLD",
            type: "WHOLESALER",
            outstandingAmount: -12500,
            creditLimit: 50000,
            creditDays: 15,
          },
          stats: { totalRevenue: 85000, totalOrders: 5, avgOrderValue: 17000 },
          recentOrders: [],
          recentPayments: [],
        },
        isLoading: false,
      });
      (useCustomerCreditScore as jest.Mock).mockReturnValue({ data: null });
      (useCustomerActivity as jest.Mock).mockReturnValue({ data: { data: [] }, isLoading: false });
      (useCustomerLedger as jest.Mock).mockReturnValue({
        data: {
          summary: {
            totalGoodsGiven: 20000,
            totalGoodsReturned: 0,
            totalPaymentsReceived: 32500,
            totalAdjustments: 0,
            netBalance: -12500,
          },
          entries: [],
        },
      });

      render(<CustomerDetailPage params={{ id: customerId }} />);

      expect(screen.getAllByText(/ADVANCE CREDIT/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/₹12,500/).length).toBeGreaterThan(0);
    });

    it("renders zero settled balance with Nil indicator and neutral styling", () => {
      (useCustomer as jest.Mock).mockReturnValue({
        data: {
          customer: {
            id: customerId,
            name: "Settled Account",
            tier: "SILVER",
            type: "RETAILER",
            outstandingAmount: 0,
          },
          stats: { totalRevenue: 50000, totalOrders: 2, avgOrderValue: 25000 },
          recentOrders: [],
          recentPayments: [],
        },
        isLoading: false,
      });
      (useCustomerCreditScore as jest.Mock).mockReturnValue({ data: null });
      (useCustomerActivity as jest.Mock).mockReturnValue({ data: { data: [] }, isLoading: false });
      (useCustomerLedger as jest.Mock).mockReturnValue({
        data: {
          summary: {
            totalGoodsGiven: 50000,
            totalGoodsReturned: 0,
            totalPaymentsReceived: 50000,
            totalAdjustments: 0,
            netBalance: 0,
          },
          entries: [],
        },
      });

      render(<CustomerDetailPage params={{ id: customerId }} />);

      expect(screen.getAllByText(/SETTLED/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Current Balance: ₹0/)).toBeInTheDocument();
      expect(screen.getByText(/Nil/)).toBeInTheDocument();
    });

    it("opens CreateTransactionModal with pre-selected type when Quick Action buttons are clicked", () => {
      (useCustomer as jest.Mock).mockReturnValue({
        data: {
          customer: {
            id: customerId,
            name: customerName,
            tier: "GOLD",
            type: "RETAILER",
            outstandingAmount: 5000,
          },
          stats: {},
          recentOrders: [],
          recentPayments: [],
        },
        isLoading: false,
      });
      (useCustomerCreditScore as jest.Mock).mockReturnValue({ data: null });
      (useCustomerActivity as jest.Mock).mockReturnValue({ data: { data: [] }, isLoading: false });

      render(<CustomerDetailPage params={{ id: customerId }} />);

      // Click + Payment Received quick action button
      const paymentBtn = screen.getByRole("button", { name: /\+ Payment Received/i });
      fireEvent.click(paymentBtn);

      expect(screen.getByRole("heading", { name: /Payment Received/i })).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 2. Chronological Sorting, Same-Date Unaggregated Rows & Hindi UTF-8
  // =========================================================================
  describe("2. Chronological Sorting & Hindi UTF-8 Line Items", () => {
    const mockEntries: LedgerEntryWithBalance[] = [
      {
        id: "tx-sale-1",
        date: "2026-08-01",
        createdAt: "2026-08-01T10:00:00Z",
        type: "SALE",
        description: "ग्राउंड फ्लोर का काम (Ground floor work)",
        amount: 15000,
        runningBalance: 15000,
        items: [
          {
            id: "item-1",
            productName: "अलमारी के लिए पत्थर",
            quantity: 10,
            unitPrice: 1500,
            amount: 15000,
            unit: "नग",
          },
        ],
      },
      {
        id: "tx-pay-1",
        date: "2026-08-01", // Multiple transactions on same date
        createdAt: "2026-08-01T14:30:00Z",
        type: "PAYMENT",
        description: "दुकान पर नकद जमा (Shop cash receipt)",
        amount: 5000,
        runningBalance: 10000,
        paymentMethod: "CASH",
        reference: "REC-001",
        items: [],
      },
      {
        id: "tx-ret-1",
        date: "2026-08-05",
        createdAt: "2026-08-05T09:00:00Z",
        type: "RETURN",
        description: "टूटा हुआ पत्थर वापसी (Broken return)",
        amount: 2000,
        runningBalance: 8000,
        items: [
          {
            id: "item-2",
            productName: "ग्रेनाइट स्लैब",
            quantity: 2,
            unitPrice: 1000,
            amount: 2000,
            unit: "PCS",
          },
        ],
      },
    ];

    it("renders same-date entries independently without aggregation in strict ascending order", () => {
      const onEdit = jest.fn();
      const onDelete = jest.fn();

      render(
        <CustomerLedgerTable
          entries={mockEntries}
          isLoading={false}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      );

      // Both same-date entries on 2026-08-01 are visible individually
      expect(screen.getByText(/ग्राउंड फ्लोर का काम/)).toBeInTheDocument();
      expect(screen.getByText(/दुकान पर नकद जमा/)).toBeInTheDocument();
      expect(screen.getByText(/टूटा हुआ पत्थर वापसी/)).toBeInTheDocument();

      // Badges render
      expect(screen.getByText("SALE")).toBeInTheDocument();
      expect(screen.getByText("PAYMENT")).toBeInTheDocument();
      expect(screen.getByText("RETURN")).toBeInTheDocument();

      // Running balances calculate and format with ₹
      expect(screen.getAllByText(/₹15,000/).length).toBeGreaterThan(0);
      expect(screen.getByText(/₹10,000/)).toBeInTheDocument();
      expect(screen.getByText(/₹8,000/)).toBeInTheDocument();
    });

    it("displays Hindi Devanagari text accurately and expands line item details", () => {
      render(<CustomerLedgerTable entries={mockEntries} isLoading={false} />);

      // Verify Hindi Devanagari text in line items is rendered
      expect(screen.getByText(/अलमारी के लिए पत्थर/)).toBeInTheDocument();
      expect(screen.getByText(/ग्रेनाइट स्लैब/)).toBeInTheDocument();

      // Toggle line items expansion accordion
      const expandBtn = screen.getByRole("button", { name: /अलमारी के लिए पत्थर/ });
      fireEvent.click(expandBtn);

      // Item breakdown details render
      expect(screen.getByText("10 नग")).toBeInTheDocument();
    });

    it("triggers onEdit and onDelete callbacks from inline action buttons", () => {
      const onEdit = jest.fn();
      const onDelete = jest.fn();

      render(
        <CustomerLedgerTable
          entries={mockEntries}
          isLoading={false}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      );

      const editButtons = screen.getAllByRole("button", { name: /edit/i });
      fireEvent.click(editButtons[0]);
      expect(onEdit).toHaveBeenCalledWith(mockEntries[0]);

      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
      fireEvent.click(deleteButtons[0]);
      expect(onDelete).toHaveBeenCalledWith(mockEntries[0]);
    });

    it("filters ledger entries by search query", () => {
      render(<CustomerLedgerTable entries={mockEntries} isLoading={false} />);

      const searchInput = screen.getByPlaceholderText(/search particulars/i);
      fireEvent.change(searchInput, { target: { value: "ग्रेनाइट" } });

      // Only granite return should be visible
      expect(screen.getByText(/ग्रेनाइट स्लैब/)).toBeInTheDocument();
      expect(screen.queryByText(/ग्राउंड फ्लोर का काम/)).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // 3. Modals (Create, Edit, Delete) & Form Submissions
  // =========================================================================
  describe("3. Modals Rendering & Form Submissions", () => {
    it("renders CreateTransactionModal, calculates item subtotal dynamically, and submits SALE", async () => {
      const onClose = jest.fn();
      const onSubmit = jest.fn();

      render(
        <CreateTransactionModal
          open={true}
          onClose={onClose}
          customerId={customerId}
          customerName={customerName}
          defaultType="SALE"
          onSubmit={onSubmit}
        />
      );

      // Verify modal title
      expect(screen.getByRole("heading", { name: /goods given/i })).toBeInTheDocument();

      // Enter Hindi item particulars
      const itemInput = screen.getByPlaceholderText(/item name/i);
      fireEvent.change(itemInput, { target: { value: "अलमारी के लिए पत्थर" } });

      const qtyInput = screen.getByPlaceholderText(/qty/i);
      fireEvent.change(qtyInput, { target: { value: "20" } });

      const rateInput = screen.getByPlaceholderText(/rate/i);
      fireEvent.change(rateInput, { target: { value: "450" } });

      // Check dynamic calculated subtotal (20 * 450 = 9000)
      expect(screen.getAllByText(/₹9,000/).length).toBeGreaterThan(0);

      // Submit form
      const submitBtn = screen.getByRole("button", { name: /save transaction/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1);
        const payload = onSubmit.mock.calls[0][0];
        expect(payload.type).toBe("SALE");
        expect(payload.amount).toBe(9000);
        expect(payload.items[0].productName).toBe("अलमारी के लिए पत्थर");
        expect(payload.items[0].quantity).toBe(20);
        expect(payload.items[0].unitPrice).toBe(450);
      });
    });

    it("renders EditTransactionModal with pre-populated values and handles update", async () => {
      const onClose = jest.fn();
      const onSubmit = jest.fn();

      const existingTx: LedgerEntryWithBalance = {
        id: "tx-edit-1",
        date: "2026-08-10",
        type: "PAYMENT",
        amount: 12000,
        paymentMethod: "UPI",
        reference: "UPI/123456",
        description: "Part payment",
        runningBalance: 5000,
        createdAt: "2026-08-10T11:00:00Z",
        items: [],
      };

      render(
        <EditTransactionModal
          open={true}
          onClose={onClose}
          customerId={customerId}
          customerName={customerName}
          transaction={existingTx}
          onSubmit={onSubmit}
        />
      );

      expect(screen.getByRole("heading", { name: /edit transaction/i })).toBeInTheDocument();
      expect(screen.getByDisplayValue("12000")).toBeInTheDocument();
      expect(screen.getByDisplayValue("UPI/123456")).toBeInTheDocument();

      // Submit updated amount
      const amountInput = screen.getByDisplayValue("12000");
      fireEvent.change(amountInput, { target: { value: "15000" } });

      const submitBtn = screen.getByRole("button", { name: /save changes/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1);
        expect(onSubmit.mock.calls[0][0].data.amount).toBe(15000);
      });
    });

    it("preserves amount when unpopulated line item is added in EditTransactionModal and blocks non-positive finalAmount", async () => {
      const onClose = jest.fn();
      const onSubmit = jest.fn();

      const existingTx: LedgerEntryWithBalance = {
        id: "tx-sale-flat",
        date: "2026-08-11",
        type: "SALE",
        amount: 5000,
        runningBalance: 5000,
        description: "Flat sale",
        createdAt: "2026-08-11T10:00:00Z",
        items: [],
      };

      render(
        <EditTransactionModal
          open={true}
          onClose={onClose}
          customerId={customerId}
          customerName={customerName}
          transaction={existingTx}
          onSubmit={onSubmit}
        />
      );

      // Add a blank row
      const addRowBtn = screen.getByRole("button", { name: /add row/i });
      fireEvent.click(addRowBtn);

      // Submit while item is unpopulated; it should fall back to existing amount (5000)
      const saveBtn = screen.getByRole("button", { name: /save changes/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1);
        expect(onSubmit.mock.calls[0][0].data.amount).toBe(5000);
      });

      // Remove the item to restore flat amount input and set it to 0
      onSubmit.mockClear();
      const removeBtn = screen.getByRole("button", { name: /remove item/i });
      fireEvent.click(removeBtn);

      const form = saveBtn.closest("form")!;
      const amountInput = screen.getByDisplayValue("5000");
      fireEvent.change(amountInput, { target: { value: "0" } });
      fireEvent.submit(form);

      expect(onSubmit).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith("Please enter a valid transaction amount or line items");
    });

    it("displays toast.error instead of blocking alert on invalid form submission in CreateTransactionModal", async () => {
      const onClose = jest.fn();
      const onSubmit = jest.fn();

      render(
        <CreateTransactionModal
          open={true}
          onClose={onClose}
          customerId={customerId}
          customerName={customerName}
          defaultType="PAYMENT"
          onSubmit={onSubmit}
        />
      );

      // Attempt to submit with 0 payment amount
      const submitBtn = screen.getByRole("button", { name: /save transaction/i });
      const form = submitBtn.closest("form")!;
      const amountInput = screen.getByPlaceholderText(/amount \(₹\)/i);
      fireEvent.change(amountInput, { target: { value: "0" } });
      fireEvent.submit(form);

      expect(onSubmit).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith("Please enter a valid payment amount");
    });

    it("renders DeleteTransactionDialog with financial reversal warning and executes delete", async () => {
      const onClose = jest.fn();
      const onSubmit = jest.fn();

      const existingTx: LedgerEntryWithBalance = {
        id: "tx-del-1",
        date: "2026-08-12",
        type: "SALE",
        amount: 8500,
        runningBalance: 20000,
        description: "Tiles sale",
        createdAt: "2026-08-12T10:00:00Z",
        items: [],
      };

      render(
        <DeleteTransactionDialog
          open={true}
          onClose={onClose}
          customerId={customerId}
          customerName={customerName}
          transaction={existingTx}
          onSubmit={onSubmit}
        />
      );

      // Verify prompt and reversal impact description
      expect(screen.getByText(/delete transaction\?/i)).toBeInTheDocument();
      expect(
        screen.getByText(/deleting this sale will decrease manish enterprises's outstanding balance by ₹8,500/i)
      ).toBeInTheDocument();

      // Click delete button
      const deleteBtn = screen.getByRole("button", { name: /delete transaction/i });
      fireEvent.click(deleteBtn);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith("tx-del-1");
      });
    });

    it("renders CreateTransactionModal, handles PAYMENT type with method and reference", async () => {
      const onClose = jest.fn();
      const onSubmit = jest.fn();

      render(
        <CreateTransactionModal
          open={true}
          onClose={onClose}
          customerId={customerId}
          customerName={customerName}
          defaultType="PAYMENT"
          onSubmit={onSubmit}
        />
      );

      expect(screen.getByRole("heading", { name: /payment received/i })).toBeInTheDocument();

      const amountInput = screen.getByPlaceholderText(/amount \(₹\)/i);
      fireEvent.change(amountInput, { target: { value: "5000" } });

      const refInput = screen.getByPlaceholderText(/upi/i);
      fireEvent.change(refInput, { target: { value: "UPI/987654" } });

      const submitBtn = screen.getByRole("button", { name: /save transaction/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1);
        const payload = onSubmit.mock.calls[0][0];
        expect(payload.type).toBe("PAYMENT");
        expect(payload.amount).toBe(5000);
        expect(payload.paymentMethod).toBe("CASH");
        expect(payload.reference).toBe("UPI/987654");
      });
    });

    it("renders CreateTransactionModal, handles ADJUSTMENT credit and debit amounts", async () => {
      const onClose = jest.fn();
      const onSubmit = jest.fn();

      render(
        <CreateTransactionModal
          open={true}
          onClose={onClose}
          customerId={customerId}
          customerName={customerName}
          defaultType="ADJUSTMENT"
          onSubmit={onSubmit}
        />
      );

      expect(screen.getByRole("heading", { name: /adjustment/i })).toBeInTheDocument();

      const amountInput = screen.getByPlaceholderText("0.00");
      fireEvent.change(amountInput, { target: { value: "250" } });

      // Default adjustment direction is CREDIT (-250)
      const submitBtn = screen.getByRole("button", { name: /save transaction/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1);
        const payload = onSubmit.mock.calls[0][0];
        expect(payload.type).toBe("ADJUSTMENT");
        expect(payload.amount).toBe(-250);
      });
    });
  });

  // =========================================================================
  // 4. Cache Invalidation and Balance Reactivity
  // =========================================================================
  describe("4. React Query Cache Invalidation", () => {
    let queryClient: QueryClient;
    const actualHooks = jest.requireActual("@/hooks/api-hooks");

    beforeEach(() => {
      queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    it("invalidates customer, ledger, and customer-list queries on transaction creation", async () => {
      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");
      (apiClient.post as jest.Mock).mockResolvedValue({
        data: { id: "new-tx", type: "SALE", amount: 10000 },
      });

      const { result } = renderHook(
        () => actualHooks.useCreateCustomerTransaction(customerId),
        { wrapper }
      );

      await act(async () => {
        result.current.mutate({
          date: "2026-09-22",
          type: "SALE",
          amount: 10000,
        });
      });

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["customers", customerId, "ledger"] });
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["customers", customerId] });
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["customers"] });
        expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("Transaction created"));
      });
    });

    it("invalidates ledger and customer caches on transaction deletion", async () => {
      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");
      (apiClient.delete as jest.Mock).mockResolvedValue({ data: { success: true } });

      const { result } = renderHook(
        () => actualHooks.useDeleteCustomerTransaction(customerId),
        { wrapper }
      );

      await act(async () => {
        result.current.mutate("tx-del-1");
      });

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["customers", customerId, "ledger"] });
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["customers", customerId] });
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["customers"] });
        expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("Transaction deleted"));
      });
    });
  });

  // =========================================================================
  // 5. Statement PDF Actions (Download, Print, and Preview Modal)
  // =========================================================================
  describe("5. Statement PDF Actions and Preview Modal", () => {
    it("generates sanitized statement filename and downloads binary PDF blob", async () => {
      const filename = buildStatementPdfFilename("Radhakishan / Manish Enterprises", "2026-09-22");
      expect(filename).toBe("RTK-Statement-Radhakishan-Manish-Enterprises-2026-09-22.pdf");
      expect(filename).not.toContain("/");
      expect(filename).not.toContain("\\");

      const mockBlob = new Blob(["%PDF-1.4 binary content"], { type: "application/pdf" });
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockBlob });

      const appendChildSpy = jest.spyOn(document.body, "appendChild");
      const removeChildSpy = jest.spyOn(document.body, "removeChild");

      await downloadCustomerStatementPdf({ customerId, customerName });

      expect(apiClient.get).toHaveBeenCalledWith(
        `/api/v1/customers/${customerId}/statement/pdf`,
        expect.objectContaining({ responseType: "blob" })
      );

      expect(window.URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
      expect(window.URL.revokeObjectURL).toHaveBeenCalledWith("blob:http://localhost/test-blob-uuid");
      expect(appendChildSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("Statement PDF downloaded", expect.any(Object));
    });

    it("renders StatementModal with RTK 5-column table and summary box", () => {
      (useCustomerStatement as jest.Mock).mockReturnValue({
        data: {
          organization: { name: "Radhakishan Trading Company", gstin: "07AAAAA0000A1Z5" },
          customer: { id: customerId, name: customerName },
          statementDate: "2026-09-22",
          rows: [
            {
              date: "2026-08-01",
              particulars: "अलमारी के लिए पत्थर (10 नग)",
              goodsGivenAmount: 15000,
              returnedAmount: null,
              paymentReceivedAmount: null,
              runningBalance: 15000,
            },
          ],
          summary: {
            totalGoodsGiven: 15000,
            totalGoodsReturned: 0,
            totalPaymentsReceived: 0,
            totalAdjustments: 0,
            netBalance: 15000,
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

      // Verify RTK Header
      expect(screen.getByText(/RTK – MANISH ENTERPRISES ACCOUNT SUMMARY/i)).toBeInTheDocument();
      // Particulars with Hindi text
      expect(screen.getByText(/अलमारी के लिए पत्थर/)).toBeInTheDocument();
      // Summary box
      expect(screen.getByText(/TOTAL GOODS GIVEN:/)).toBeInTheDocument();
      expect(screen.getByText(/LESS: GOODS RETURNED:/)).toBeInTheDocument();
      expect(screen.getByText(/LESS: PAYMENTS RECEIVED:/)).toBeInTheDocument();

      // Download and Print buttons exist
      expect(screen.getByRole("button", { name: /download pdf/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /print/i })).toBeInTheDocument();
    });

    it("handles printCustomerStatement by fetching statement pdf blob", async () => {
      const mockBlob = new Blob(["%PDF-1.4 binary content"], { type: "application/pdf" });
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockBlob });

      await printCustomerStatement({ customerId });

      expect(apiClient.get).toHaveBeenCalledWith(
        `/api/v1/customers/${customerId}/statement/pdf`,
        expect.objectContaining({ responseType: "blob" })
      );
      expect(window.URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
    });

    it("renders StatementModal negative net balance with Math.abs and Cr indicator", () => {
      (useCustomerStatement as jest.Mock).mockReturnValue({
        data: {
          organization: { name: "Radhakishan Trading Company", gstin: "07AAAAA0000A1Z5" },
          customer: { id: customerId, name: customerName },
          statementDate: "2026-09-22",
          rows: [],
          summary: {
            totalGoodsGiven: 5000,
            totalGoodsReturned: 0,
            totalPaymentsReceived: 17500,
            totalAdjustments: 0,
            netBalance: -12500,
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

      // Verify absolute balance ₹12,500 and Cr badge rendered without negative sign
      expect(screen.getByText("₹12,500")).toBeInTheDocument();
      expect(screen.getByText("Cr")).toBeInTheDocument();
      expect(screen.queryByText("₹-12,500")).not.toBeInTheDocument();
    });

    it("extracts error message from Blob response in extractBlobErrorMessage", async () => {
      const mockErrorBlob = new Blob([JSON.stringify({ error: { message: "Statement date out of range" } })], {
        type: "application/json",
      });
      const errorWithBlob = {
        response: {
          data: mockErrorBlob,
        },
      };

      const msg = await extractBlobErrorMessage(errorWithBlob);
      expect(msg).toBe("Statement date out of range");

      // Fallback on network/generic error
      (getApiError as jest.Mock).mockReturnValue({ message: "Network error", code: "NETWORK_ERROR", statusCode: 0 });
      const genericMsg = await extractBlobErrorMessage(new Error("Network failed"));
      expect(genericMsg).toBe("Network error");
    });
  });
});
