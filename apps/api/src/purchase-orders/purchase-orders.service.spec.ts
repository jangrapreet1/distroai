/**
 * Unit tests for Purchase Orders partial fulfillment, Goods Receipt (GRN),
 * and supplier financial synchronization.
 */

describe('Purchase Orders Fulfillment & Supplier Sync Engine', () => {
    describe('PO Status State Machine', () => {
        const VALID_PO_TRANSITIONS: Record<string, string[]> = {
            DRAFT: ['SENT', 'CANCELLED'],
            SENT: ['ACKNOWLEDGED', 'PARTIALLY_DELIVERED', 'RECEIVED', 'CANCELLED'],
            ACKNOWLEDGED: ['PARTIALLY_DELIVERED', 'RECEIVED', 'CANCELLED'],
            PARTIALLY_DELIVERED: ['PARTIALLY_DELIVERED', 'RECEIVED', 'CANCELLED'],
            RECEIVED: ['COMPLETED'],
            COMPLETED: [],
            CANCELLED: [],
        };

        function canTransitionPO(from: string, to: string): boolean {
            return VALID_PO_TRANSITIONS[from]?.includes(to) ?? false;
        }

        it('allows valid partial delivery progression', () => {
            expect(canTransitionPO('DRAFT', 'SENT')).toBe(true);
            expect(canTransitionPO('SENT', 'PARTIALLY_DELIVERED')).toBe(true);
            expect(canTransitionPO('PARTIALLY_DELIVERED', 'PARTIALLY_DELIVERED')).toBe(true);
            expect(canTransitionPO('PARTIALLY_DELIVERED', 'RECEIVED')).toBe(true);
            expect(canTransitionPO('RECEIVED', 'COMPLETED')).toBe(true);
        });

        it('disallows invalid transitions', () => {
            expect(canTransitionPO('DRAFT', 'RECEIVED')).toBe(false);
            expect(canTransitionPO('CANCELLED', 'RECEIVED')).toBe(false);
            expect(canTransitionPO('COMPLETED', 'DRAFT')).toBe(false);
        });
    });

    describe('Partial Goods Receipt (GRN) Quantity Engine', () => {
        interface POLineItem {
            id: string;
            orderedQty: number;
            deliveredQty: number;
            cancelledQty?: number;
        }

        function calculateGRNReceipt(
            items: POLineItem[],
            receipt: { id: string; receivedQty: number }[]
        ) {
            const updatedItems = items.map((item) => {
                const r = receipt.find((rec) => rec.id === item.id);
                const toReceive = r ? r.receivedQty : 0;
                const currentDelivered = item.deliveredQty || 0;
                const pending = Math.max(0, item.orderedQty - currentDelivered - (item.cancelledQty || 0));

                if (toReceive > pending) {
                    throw new Error(`OVER_RECEIPT: Received qty ${toReceive} exceeds pending ${pending} for line ${item.id}`);
                }

                const newDelivered = currentDelivered + toReceive;
                const newPending = Math.max(0, item.orderedQty - newDelivered - (item.cancelledQty || 0));

                return {
                    ...item,
                    deliveredQty: newDelivered,
                    pendingQty: newPending,
                };
            });

            const hasPending = updatedItems.some((it) => it.pendingQty > 0);
            const poStatus = hasPending ? 'PARTIALLY_DELIVERED' : 'RECEIVED';

            return { updatedItems, poStatus };
        }

        it('correctly calculates partial receipt and sets PARTIALLY_DELIVERED', () => {
            const initialItems: POLineItem[] = [
                { id: 'item-1', orderedQty: 50, deliveredQty: 0 },
                { id: 'item-2', orderedQty: 20, deliveredQty: 0 },
            ];

            const result = calculateGRNReceipt(initialItems, [
                { id: 'item-1', receivedQty: 25 },
                { id: 'item-2', receivedQty: 20 },
            ]);

            expect(result.poStatus).toBe('PARTIALLY_DELIVERED');
            expect(result.updatedItems[0].deliveredQty).toBe(25);
            expect(result.updatedItems[0].pendingQty).toBe(25);
            expect(result.updatedItems[1].deliveredQty).toBe(20);
            expect(result.updatedItems[1].pendingQty).toBe(0);
        });

        it('transitions to RECEIVED once all line items are fulfilled', () => {
            const initialItems: POLineItem[] = [
                { id: 'item-1', orderedQty: 50, deliveredQty: 25 },
                { id: 'item-2', orderedQty: 20, deliveredQty: 20 },
            ];

            const result = calculateGRNReceipt(initialItems, [
                { id: 'item-1', receivedQty: 25 },
                { id: 'item-2', receivedQty: 0 },
            ]);

            expect(result.poStatus).toBe('RECEIVED');
            expect(result.updatedItems[0].deliveredQty).toBe(50);
            expect(result.updatedItems[0].pendingQty).toBe(0);
        });

        it('strictly prevents over-receipt exceeding pending balance', () => {
            const initialItems: POLineItem[] = [
                { id: 'item-1', orderedQty: 50, deliveredQty: 45 },
            ];

            expect(() => {
                calculateGRNReceipt(initialItems, [{ id: 'item-1', receivedQty: 10 }]);
            }).toThrow(/OVER_RECEIPT/);
        });
    });

    describe('Supplier Financial & Performance Synchronization', () => {
        function updateSupplierDeliveryStats(
            currentOutstanding: number,
            batchValue: number,
            allPOs: { items: { orderedQty: number; deliveredQty: number }[] }[]
        ) {
            const newOutstanding = currentOutstanding + batchValue;
            let totalOrdered = 0;
            let totalDelivered = 0;

            for (const po of allPOs) {
                for (const item of po.items) {
                    totalOrdered += item.orderedQty;
                    totalDelivered += item.deliveredQty;
                }
            }

            const fulfillmentRate = totalOrdered > 0
                ? Math.round((totalDelivered / totalOrdered) * 1000) / 10
                : 100;

            return {
                outstandingBalance: newOutstanding,
                fulfillmentRate,
                lastDeliveryDate: new Date(),
            };
        }

        it('increments supplier outstanding balance and recalculates fulfillment rate', () => {
            const allPOs = [
                {
                    items: [
                        { orderedQty: 100, deliveredQty: 80 },
                        { orderedQty: 50, deliveredQty: 40 },
                    ]
                }
            ];

            const stats = updateSupplierDeliveryStats(50000, 25000, allPOs);
            expect(stats.outstandingBalance).toBe(75000);
            // 120 / 150 = 80%
            expect(stats.fulfillmentRate).toBe(80);
            expect(stats.lastDeliveryDate).toBeInstanceOf(Date);
        });

        it('reduces supplier balance and updates paymentStatus upon expense payment', () => {
            function recordPOPayment(
                poTotal: number,
                currentPaid: number,
                supplierOutstanding: number,
                paymentAmount: number
            ) {
                const newPaid = Math.min(poTotal, currentPaid + paymentAmount);
                const newSupplierBalance = Math.max(0, supplierOutstanding - paymentAmount);
                const paymentStatus = newPaid >= poTotal ? 'PAID' : newPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID';

                return {
                    paidAmount: newPaid,
                    supplierOutstanding: newSupplierBalance,
                    paymentStatus,
                };
            }

            // Partial payout
            const partial = recordPOPayment(100000, 0, 100000, 40000);
            expect(partial.paidAmount).toBe(40000);
            expect(partial.supplierOutstanding).toBe(60000);
            expect(partial.paymentStatus).toBe('PARTIALLY_PAID');

            // Final payout
            const full = recordPOPayment(100000, 40000, 60000, 60000);
            expect(full.paidAmount).toBe(100000);
            expect(full.supplierOutstanding).toBe(0);
            expect(full.paymentStatus).toBe('PAID');
        });
    });
});
