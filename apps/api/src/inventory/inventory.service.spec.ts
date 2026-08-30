/**
 * Unit tests for Inventory stock deduction logic.
 */

function canFulfillOrder(requestedQty: number, availableStock: number, reservedStock: number = 0): boolean {
    const actualAvailable = availableStock - reservedStock;
    return actualAvailable >= requestedQty;
}

function calculateNewStockLevels(requestedQty: number, currentStock: number) {
    if (currentStock < requestedQty) {
        throw new Error("Insufficient stock");
    }
    return {
        newQuantity: currentStock - requestedQty,
    };
}

describe('Inventory Business Logic', () => {
    it('should accurately determine if an order can be fulfilled considering reserved stock', () => {
        // 100 in stock, 20 reserved, want 90 -> false (only 80 available)
        expect(canFulfillOrder(90, 100, 20)).toBe(false);

        // 100 in stock, 20 reserved, want 80 -> true
        expect(canFulfillOrder(80, 100, 20)).toBe(true);

        // 100 in stock, 0 reserved, want 100 -> true
        expect(canFulfillOrder(100, 100, 0)).toBe(true);
    });

    it('should calculate new stock levels on deduction', () => {
        const result = calculateNewStockLevels(15, 100);
        expect(result.newQuantity).toBe(85);
    });

    it('should throw error when deducting beyond current stock', () => {
        expect(() => calculateNewStockLevels(150, 100)).toThrow("Insufficient stock");
    });
});
