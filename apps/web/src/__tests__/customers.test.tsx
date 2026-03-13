import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CustomersPage from '@/app/(dashboard)/customers/page';
import { useCustomers, useCreateCustomer } from '@/hooks/api-hooks';

// Mock the dependencies
jest.mock('@/hooks/api-hooks');
jest.mock('next/navigation', () => ({
    useRouter: () => ({
        push: jest.fn(),
    }),
}));

describe('CustomersPage and AddCustomerModal behavior', () => {
    const mockMutate = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock the GET hook to return empty data so the page renders
        (useCustomers as jest.Mock).mockReturnValue({
            data: { data: [], meta: { total: 0 } },
            isLoading: false,
        });

        // Mock the POST hook
        (useCreateCustomer as jest.Mock).mockReturnValue({
            mutate: mockMutate,
            isPending: false,
        });
    });

    it('opens modal, fills data, and submits when Create Customer button is clicked', async () => {
        render(<CustomersPage />);

        // 1. Find and click the "Add Customer" button on the main page
        const addCustomerBtn = screen.getByRole('button', { name: /add customer/i });
        fireEvent.click(addCustomerBtn);

        // 2. Wait for modal to appear
        expect(screen.getByRole('heading', { name: 'Add Customer' })).toBeInTheDocument();

        // 3. Find input fields
        // We use next sibling or explicit labels
        const nameInput = screen.getAllByRole('textbox')[1]; // First is search, second is name

        // Enter mock data
        fireEvent.change(nameInput, { target: { value: 'Acme Corp' } });

        // Find Phone by placeholder since 'Phone' text is also in the table header
        const phoneInput = screen.getAllByPlaceholderText('+91XXXXXXXXXX')[0];
        fireEvent.change(phoneInput, { target: { value: '9876543210' } });

        // 4. Find and click the Submit button inside the modal
        const submitBtn = screen.getAllByRole('button', { name: 'Add Customer' })[1];
        fireEvent.click(submitBtn);

        // 5. Verify the behavior: Did it call the mutate function with the correct mock payload?
        await waitFor(() => {
            expect(mockMutate).toHaveBeenCalledTimes(1);
            // The first argument of the first call is the payload
            const payload = mockMutate.mock.calls[0][0];
            expect(payload.name).toBe('Acme Corp');
            expect(payload.phone).toBe('9876543210');
            expect(payload.type).toBe('RETAILER'); // default value
            expect(payload.state).toBe('Maharashtra'); // default value
        });
    });

    it('closes the modal when Cancel button is clicked', () => {
        render(<CustomersPage />);

        // Open modal
        fireEvent.click(screen.getByRole('button', { name: /add customer/i }));
        expect(screen.getByRole('heading', { name: 'Add Customer' })).toBeInTheDocument();

        // Find Cancel button and click
        const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
        fireEvent.click(cancelBtn);

        // Verify modal is gone
        expect(screen.queryByRole('heading', { name: 'Add Customer' })).not.toBeInTheDocument();
        // Ensure mutate was never called
        expect(mockMutate).not.toHaveBeenCalled();
    });
});
