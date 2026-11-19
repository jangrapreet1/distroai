import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UniversalImportModal } from '@/components/modals/UniversalImportModal';
import apiClient from '@/lib/api-client';

// Mock dependencies
jest.mock('@/lib/api-client');
jest.mock('react-hot-toast', () => ({
    success: jest.fn(),
    error: jest.fn(),
    loading: jest.fn(),
    dismiss: jest.fn(),
}));

describe('UniversalImportModal - Smart Paste Feature', () => {
    const mockOnClose = jest.fn();
    const mockOnSuccess = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        (apiClient.post as jest.Mock).mockResolvedValue({
            data: {
                data: {
                    totalRows: 2,
                    validCount: 2,
                    invalidCount: 0,
                    projectedBalance: 15000,
                    mapping: { date: 'DATE', saleAmount: 'AMOUNT' },
                    validationResults: [
                        { rowIndex: 1, isValid: true, txType: 'SALE', effectiveAmount: 10000, data: { date: '2026-08-04', saleAmount: 10000 } },
                        { rowIndex: 2, isValid: true, txType: 'SALE', effectiveAmount: 5000, data: { date: '2026-08-10', saleAmount: 5000 } },
                    ],
                },
            },
        });
    });

    it('renders both Upload File and Paste Table tab options', () => {
        render(
            <UniversalImportModal
                isOpen={true}
                onClose={mockOnClose}
                onSuccess={mockOnSuccess}
                type="customer-transactions"
                customerId="cust-1"
                customerName="Sunny Bhai"
            />
        );

        expect(screen.getByRole('button', { name: /Upload File/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Paste Table/i })).toBeInTheDocument();
    });

    it('switches to paste table mode and updates line counter when pasting text', () => {
        render(
            <UniversalImportModal
                isOpen={true}
                onClose={mockOnClose}
                onSuccess={mockOnSuccess}
                type="customer-transactions"
                customerId="cust-1"
                customerName="Sunny Bhai"
            />
        );

        // Click Paste Table tab
        const pasteTab = screen.getByText(/Paste Table from Docs \/ WhatsApp/i);
        fireEvent.click(pasteTab);

        // Textarea should appear
        const textarea = screen.getByPlaceholderText(/Paste table copied directly from Google Docs or Word/i);
        expect(textarea).toBeInTheDocument();

        // Paste some rows
        const sampleText = `DATE\tGOODS GIVEN\tAMOUNT\n04/08/26\tLeveler\t₹10,000\n10/08/26\tAdhesive\t₹5,000`;
        fireEvent.change(textarea, { target: { value: sampleText } });

        // Line counter & format detection badge
        expect(screen.getByText(/3 lines detected/i)).toBeInTheDocument();
        expect(screen.getByText(/Tab-Separated Table/i)).toBeInTheDocument();
    });

    it('submits pasted table to preview endpoint when Continue to Preview is clicked', async () => {
        render(
            <UniversalImportModal
                isOpen={true}
                onClose={mockOnClose}
                onSuccess={mockOnSuccess}
                type="customer-transactions"
                customerId="cust-1"
                customerName="Sunny Bhai"
            />
        );

        // Switch to paste tab
        fireEvent.click(screen.getByText(/Paste Table from Docs \/ WhatsApp/i));

        const textarea = screen.getByPlaceholderText(/Paste table copied directly from Google Docs or Word/i);
        fireEvent.change(textarea, {
            target: { value: `| DATE | AMOUNT |\n| 04/08/26 | ₹10,000 |\n| 10/08/26 | ₹5,000 |` },
        });

        const continueBtn = screen.getByRole('button', { name: /Continue to Preview/i });
        expect(continueBtn).not.toBeDisabled();

        fireEvent.click(continueBtn);

        await waitFor(() => {
            expect(apiClient.post).toHaveBeenCalledWith(
                '/api/v1/customers/cust-1/transactions/import/preview',
                expect.any(FormData),
                expect.objectContaining({
                    headers: { 'Content-Type': 'multipart/form-data' },
                })
            );
        });

        // Moves to step 2 (Preview)
        await waitFor(() => {
            expect(screen.getByText('Valid Rows')).toBeInTheDocument();
        });
    });

    it('allows inline editing of transaction amounts and dynamically recalculates projected balance', async () => {
        render(
            <UniversalImportModal
                isOpen={true}
                onClose={mockOnClose}
                onSuccess={mockOnSuccess}
                type="customer-transactions"
                customerId="cust-1"
                customerName="Sunny Bhai"
            />
        );

        fireEvent.click(screen.getByText(/Paste Table from Docs \/ WhatsApp/i));
        const textarea = screen.getByPlaceholderText(/Paste table copied directly from Google Docs or Word/i);
        fireEvent.change(textarea, {
            target: { value: `| DATE | AMOUNT |\n| 04/08/26 | ₹10,000 |\n| 10/08/26 | ₹5,000 |` },
        });

        fireEvent.click(screen.getByRole('button', { name: /Continue to Preview/i }));

        await waitFor(() => {
            expect(screen.getByText('Valid Rows')).toBeInTheDocument();
        });

        // Initial projected balance card displays ₹15,000
        expect(screen.getByText(/₹15,000/)).toBeInTheDocument();

        // Find saleAmount input for row 1 and update from 10000 to 20000
        const inputs = screen.getAllByRole('spinbutton');
        // Row 1 saleAmount is the first spinbutton
        fireEvent.change(inputs[0], { target: { value: '20000' } });

        // Projected balance card dynamically updates to ₹25,000 (20000 + 5000)
        await waitFor(() => {
            expect(screen.getAllByText(/₹25,000/).length).toBeGreaterThanOrEqual(1);
        });
    });

    it('allows deleting a row and dynamically recalculates projected balance', async () => {
        render(
            <UniversalImportModal
                isOpen={true}
                onClose={mockOnClose}
                onSuccess={mockOnSuccess}
                type="customer-transactions"
                customerId="cust-1"
                customerName="Sunny Bhai"
            />
        );

        fireEvent.click(screen.getByText(/Paste Table from Docs \/ WhatsApp/i));
        const textarea = screen.getByPlaceholderText(/Paste table copied directly from Google Docs or Word/i);
        fireEvent.change(textarea, {
            target: { value: `| DATE | AMOUNT |\n| 04/08/26 | ₹10,000 |\n| 10/08/26 | ₹5,000 |` },
        });

        fireEvent.click(screen.getByRole('button', { name: /Continue to Preview/i }));

        await waitFor(() => {
            expect(screen.getByText('Valid Rows')).toBeInTheDocument();
        });

        // Click delete button on row 1
        const deleteButtons = screen.getAllByTitle('Delete row');
        expect(deleteButtons).toHaveLength(2);
        fireEvent.click(deleteButtons[0]);

        // After deleting row 1 (10000), only row 2 (5000) remains, projected balance updates to ₹5,000
        await waitFor(() => {
            expect(screen.getAllByText(/₹5,000/).length).toBeGreaterThanOrEqual(1);
        });
    });
});
