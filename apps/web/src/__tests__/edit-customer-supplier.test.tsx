import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EditCustomerModal } from "@/components/modals/EditCustomerModal";
import { EditSupplierModal } from "@/components/modals/EditSupplierModal";
import { useUpdateCustomer, useUpdateSupplier, useOrg } from "@/hooks/api-hooks";

jest.mock("@/hooks/api-hooks");

describe("Edit Customer & Supplier Modals", () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const renderWithClient = (ui: React.ReactElement) =>
        render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);

    const mockUpdateCustomerMutate = jest.fn();
    const mockUpdateSupplierMutate = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();

        (useOrg as jest.Mock).mockReturnValue({
            data: { data: { state: "Haryana" } },
        });

        (useUpdateCustomer as jest.Mock).mockReturnValue({
            mutate: mockUpdateCustomerMutate,
            isPending: false,
        });

        (useUpdateSupplier as jest.Mock).mockReturnValue({
            mutate: mockUpdateSupplierMutate,
            isPending: false,
        });
    });

    describe("EditCustomerModal", () => {
        const mockCustomer = {
            id: "cust-1",
            name: "Radhe Traders",
            contactPerson: "Mukesh",
            phone: "9812466888",
            altPhone: "9812400000",
            email: "radhe@example.com",
            type: "RETAILER",
            tier: "GOLD",
            gstNumber: "06AAAAA0000A1Z5",
            panNumber: "AAAAA0000A",
            fullAddress: "123 Market Rd",
            city: "Rohtak",
            state: "Haryana",
            pincode: "124001",
            creditLimit: 50000,
            creditDays: 30,
            gracePeriodDays: 7,
            isActive: true,
        };

        it("renders with pre-populated customer data", () => {
            renderWithClient(
                <EditCustomerModal open={true} onClose={jest.fn()} customer={mockCustomer} />
            );

            expect(screen.getByDisplayValue("Radhe Traders")).toBeInTheDocument();
            expect(screen.getByDisplayValue("Mukesh")).toBeInTheDocument();
            expect(screen.getByDisplayValue("9812466888")).toBeInTheDocument();
            expect(screen.getByDisplayValue("06AAAAA0000A1Z5")).toBeInTheDocument();
            expect(screen.getByDisplayValue("Rohtak")).toBeInTheDocument();
        });

        it("submits updated customer details", () => {
            renderWithClient(
                <EditCustomerModal open={true} onClose={jest.fn()} customer={mockCustomer} />
            );

            const nameInput = screen.getByDisplayValue("Radhe Traders");
            fireEvent.change(nameInput, { target: { value: "Radhe Shyam Mega Store" } });

            const cityInput = screen.getByDisplayValue("Rohtak");
            fireEvent.change(cityInput, { target: { value: "Hisar" } });

            const submitBtn = screen.getByRole("button", { name: /save customer details/i });
            fireEvent.click(submitBtn);

            expect(mockUpdateCustomerMutate).toHaveBeenCalledWith(
                {
                    id: "cust-1",
                    data: expect.objectContaining({
                        name: "Radhe Shyam Mega Store",
                        city: "Hisar",
                        gstNumber: "06AAAAA0000A1Z5",
                    }),
                },
                expect.any(Object)
            );
        });
    });

    describe("EditSupplierModal", () => {
        const mockSupplier = {
            id: "supp-1",
            name: "Sun Pharma Distributors",
            contactPerson: "Rajesh",
            phone: "9876543210",
            email: "orders@sunpharma.com",
            gstNumber: "07AAAAA0000A1Z5",
            panNumber: "AAAAA0000A",
            address: "Plot 10, Okhla Phase 3",
            city: "Delhi",
            state: "Delhi",
            pincode: "110020",
            leadTimeDays: 4,
            creditDays: 45,
            notes: "Payment via RTGS only",
            isActive: true,
        };

        it("renders with pre-populated supplier data", () => {
            renderWithClient(
                <EditSupplierModal open={true} onClose={jest.fn()} supplier={mockSupplier} />
            );

            expect(screen.getByDisplayValue("Sun Pharma Distributors")).toBeInTheDocument();
            expect(screen.getByDisplayValue("Rajesh")).toBeInTheDocument();
            expect(screen.getByDisplayValue("9876543210")).toBeInTheDocument();
            expect(screen.getByDisplayValue("07AAAAA0000A1Z5")).toBeInTheDocument();
            expect(screen.getByDisplayValue("Delhi")).toBeInTheDocument();
        });

        it("submits updated supplier details", () => {
            renderWithClient(
                <EditSupplierModal open={true} onClose={jest.fn()} supplier={mockSupplier} />
            );

            const nameInput = screen.getByDisplayValue("Sun Pharma Distributors");
            fireEvent.change(nameInput, { target: { value: "Sun Pharma Logistics Pvt Ltd" } });

            const submitBtn = screen.getByRole("button", { name: /save supplier details/i });
            fireEvent.click(submitBtn);

            expect(mockUpdateSupplierMutate).toHaveBeenCalledWith(
                {
                    id: "supp-1",
                    data: expect.objectContaining({
                        name: "Sun Pharma Logistics Pvt Ltd",
                        phone: "9876543210",
                        gstNumber: "07AAAAA0000A1Z5",
                    }),
                },
                expect.any(Object)
            );
        });
    });
});
