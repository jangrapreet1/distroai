import { render, screen } from '@testing-library/react';
import { ConversionFunnel } from '@/components/dashboard/ConversionFunnel';
import { CreditRiskDial } from '@/components/dashboard/CreditRiskDial';

describe('Workstream 1 Verification: Zero Mock Data & Clean Empty States', () => {
    describe('ConversionFunnel Component', () => {
        it('renders clean zero-state when tenant has 0 events and no mock data leaks', () => {
            render(
                <ConversionFunnel
                    totalVisits={0}
                    totalVisitsAmount={0}
                    totalOrders={0}
                    totalOrdersAmount={0}
                    totalDispatched={0}
                    totalDispatchedAmount={0}
                    totalReconciled={0}
                    totalReconciledAmount={0}
                    avgAiTranscriptionTime={0}
                />
            );

            // Verify strict elimination of all previously hardcoded toy data
            expect(screen.queryByText('184')).not.toBeInTheDocument();
            expect(screen.queryByText('162')).not.toBeInTheDocument();
            expect(screen.queryByText('154')).not.toBeInTheDocument();
            expect(screen.queryByText('148')).not.toBeInTheDocument();
            expect(screen.queryByText('₹2.45L')).not.toBeInTheDocument();
            expect(screen.queryByText('₹2.31L')).not.toBeInTheDocument();
            expect(screen.queryByText('₹2.24L')).not.toBeInTheDocument();
            expect(screen.queryByText(/2\.4s/)).not.toBeInTheDocument();

            // Verify clean empty state indicator
            expect(screen.getByText(/No pipeline records detected yet/i)).toBeInTheDocument();
        });

        it('dynamically computes yields and amounts from live props without division by zero', () => {
            render(
                <ConversionFunnel
                    totalVisits={100}
                    totalVisitsAmount={500000}
                    totalOrders={80}
                    totalOrdersAmount={400000}
                    totalDispatched={60}
                    totalDispatchedAmount={300000}
                    totalReconciled={50}
                    totalReconciledAmount={250000}
                    avgAiTranscriptionTime={1.8}
                    upiInstantCaptureRate={95}
                />
            );

            // 80/100 = 80% yield
            expect(screen.getByText('80% Yield')).toBeInTheDocument();
            // 60/80 = 75% yield
            expect(screen.getByText('75% Yield')).toBeInTheDocument();
            // 50/60 = 83% yield
            expect(screen.getByText('83% Yield')).toBeInTheDocument();
            expect(screen.getByText(/1\.8s/)).toBeInTheDocument();
            expect(screen.getByText(/95%/)).toBeInTheDocument();
        });
    });

    describe('CreditRiskDial Component', () => {
        it('renders clean zero-state without static fallback strings', () => {
            render(
                <CreditRiskDial
                    score={100}
                    totalOutstanding={0}
                    totalCreditLimit={0}
                    highRiskCount={0}
                    avgDsoDays={0}
                />
            );

            // Verify removal of hardcoded dummy strings
            expect(screen.queryByText('14d faster than avg')).not.toBeInTheDocument();
            expect(screen.queryByText('₹42k at risk')).not.toBeInTheDocument();

            // Verify dynamic indicators
            expect(screen.getByText('No aging debt')).toBeInTheDocument();
            expect(screen.getByText('Zero default risk')).toBeInTheDocument();
            expect(screen.getByText('100')).toBeInTheDocument();
            expect(screen.getByText('0%')).toBeInTheDocument(); // Limit Utilized
        });

        it('correctly displays watchlist and aging debt when data exists', () => {
            render(
                <CreditRiskDial
                    score={50}
                    totalOutstanding={200000}
                    totalCreditLimit={500000}
                    highRiskCount={4}
                    avgDsoDays={45}
                />
            );

            expect(screen.getByText('4 Retailers')).toBeInTheDocument();
            expect(screen.getByText('4 need review')).toBeInTheDocument();
            expect(screen.getByText('45 Days')).toBeInTheDocument();
            expect(screen.getByText('Exceeds 30d terms')).toBeInTheDocument();
            expect(screen.getByText('40%')).toBeInTheDocument(); // 200k / 500k = 40%
        });
    });
});
