import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginPage from '@/app/(auth)/login/page';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';

// Mock the dependencies
jest.mock('@/hooks/use-auth');
jest.mock('next/navigation');

describe('LoginPage behavior', () => {
    const mockLogin = jest.fn();
    const mockPush = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        (useAuth as jest.Mock).mockReturnValue({
            login: mockLogin,
            isLoggingIn: false,
        });
        (useRouter as jest.Mock).mockReturnValue({
            push: mockPush,
        });
    });

    it('submits with mock data when clicking Sign In', async () => {
        render(<LoginPage />);
        
        // Find inputs
        const emailInput = screen.getByPlaceholderText('you@company.com');
        const passwordInput = screen.getByPlaceholderText('Enter your password');
        const signInButton = screen.getByRole('button', { name: /sign in/i });

        // Enter mock data
        fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'password123' } });

        // Click the button
        fireEvent.click(signInButton);

        // Verify the behavior: Did it call the login function with our mock data?
        await waitFor(() => {
            expect(mockLogin).toHaveBeenCalledWith({
                email: 'test@example.com',
                password: 'password123',
            });
        });
    });

    it('shows validation error when fields are empty', async () => {
        render(<LoginPage />);
        
        const signInButton = screen.getByRole('button', { name: /sign in/i });

        // Click without entering data
        fireEvent.click(signInButton);

        // Verify behavior: Did it show an error instead of submitting?
        await waitFor(() => {
            expect(screen.getByText('Password is required')).toBeInTheDocument();
        });
        expect(mockLogin).not.toHaveBeenCalled();
    });

    it('disables the button when logging in', () => {
        (useAuth as jest.Mock).mockReturnValue({
            login: mockLogin,
            isLoggingIn: true, // Simulate loading state
        });

        render(<LoginPage />);
        
        const signInButton = screen.getByRole('button', { name: /signing in.../i });
        expect(signInButton).toBeDisabled();
    });
});
