import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Tool: get_product_details
 * Lets the AI look up exact product details by SKU, name, or fuzzy match
 */
export const createGetProductDetailsTool = (orgId: string, prisma: PrismaService) => {
    return new DynamicStructuredTool({
        name: "get_product_details",
        description: `Look up a product's full details by an EXACT SKU code or EXACT product name. Returns MRP, selling price, purchase price, stock quantity, category, brand. Use this ONLY when the user asks about a very specific known product name (e.g. "Parle G 250g") or scans an exact barcode. DO NOT use this for vague, descriptive, or category searches (e.g. "sweet snacks", "cheap biscuits")—use semantic_product_search for that instead!`,
        schema: z.object({
            query: z.string().describe("Product SKU code, exact name, or partial name to search for"),
        }),
        func: (async ({ query }: { query: string }) => {
            // Try exact SKU match first
            let product = await prisma.product.findFirst({
                where: { orgId, sku: { equals: query, mode: 'insensitive' } },
            });

            // Fallback to name search
            if (!product) {
                product = await prisma.product.findFirst({
                    where: { orgId, name: { contains: query, mode: 'insensitive' } },
                });
            }

            if (!product) {
                // Try broader search
                const products = await prisma.product.findMany({
                    where: {
                        orgId,
                        OR: [
                            { name: { contains: query, mode: 'insensitive' } },
                            { sku: { contains: query, mode: 'insensitive' } },
                            { brand: { contains: query, mode: 'insensitive' } },
                            { category: { contains: query, mode: 'insensitive' } },
                        ]
                    },
                    take: 5,
                });

                if (products.length === 0) {
                    return JSON.stringify({ error: `No product found matching "${query}"` });
                }

                return JSON.stringify(products.map(p => ({
                    id: p.id,
                    name: p.name,
                    sku: p.sku,
                    mrp: p.mrp,
                    sellingPrice: p.sellingPrice,
                    category: p.category,
                    brand: p.brand,
                })));
            }

            // Get stock info
            const inventory = await prisma.inventory.findFirst({
                where: { orgId, productId: product.id },
            });

            return JSON.stringify({
                id: product.id,
                name: product.name,
                sku: product.sku,
                mrp: product.mrp,
                sellingPrice: product.sellingPrice,
                purchasePrice: product.purchasePrice,
                category: product.category,
                brand: product.brand,
                hsnCode: product.hsnCode,
                gstRate: product.gstRate,
                cessRate: product.cessRate,
                unit: product.unit,
                minStockLevel: product.minStockLevel,
                isActive: product.isActive,
                stockQuantity: inventory?.quantity ?? 0,
                reservedQty: inventory?.reservedQty ?? 0,
                availableStock: (inventory?.quantity ?? 0) - (inventory?.reservedQty ?? 0),
            });
        }) as any,
    });
};

/**
 * Tool: get_restock_forecast
 * Lets the AI analyze sales velocity to draft highly accurate Purchase Orders.
 */
export const createGetRestockRecommendationsTool = (orgId: string, prisma: PrismaService) => {
    return new DynamicStructuredTool({
        name: "get_restock_forecast",
        description: `Analyze inventory levels and trailing sales velocity to propose optimized Purchase Orders for restocking.
Note: velocity calculation is trailing and does not account for seasonal or festival demand patterns. A 30-day window in January may underrepresent demand for products with Diwali-season spikes. Advise the user to adjust windowDays accordingly for seasonal products.`,
        schema: z.object({
            windowDays: z.number().optional().default(30).describe("The lookback period in days to calculate sales velocity"),
            limit: z.number().optional().default(10).describe("Max products to recommend for restock"),
        }),
        func: (async ({ windowDays, limit }: any) => {
            const lookbackDate = new Date();
            lookbackDate.setDate(lookbackDate.getDate() - windowDays);

            // Fetch products strictly mapped to requesting orgId
            const products = await prisma.product.findMany({
                where: { orgId, isActive: true },
                select: { id: true, name: true, sku: true, minStockLevel: true, inventories: { select: { quantity: true, reservedQty: true } } },
            });

            // Calculate velocity from OrderItems in the trailing window
            const velocityData = await prisma.orderItem.groupBy({
                by: ['productId'],
                where: {
                    order: { orgId, createdAt: { gte: lookbackDate }, status: { in: ['DELIVERED', 'DISPATCHED', 'CONFIRMED'] } }
                },
                _sum: { quantity: true }
            });

            const velocityMap = new Map();
            velocityData.forEach(v => velocityMap.set(v.productId, v._sum.quantity || 0));

            const recommendations: any[] = [];

            for (const p of products) {
                const availableStock = p.inventories.reduce((acc, inv) => acc + (inv.quantity - inv.reservedQty), 0);
                const velocity = velocityMap.get(p.id) || 0;

                if (availableStock <= p.minStockLevel || (velocity > availableStock && velocity > 0)) {
                    // Replenish buffer -> minStock + 1.5x trailing cycle
                    const buffer = Math.ceil(velocity * 1.5);
                    const suggestedRestockQty = Math.max(0, (p.minStockLevel + buffer) - availableStock);

                    if (suggestedRestockQty > 0) {
                        recommendations.push({
                            productName: p.name,
                            sku: p.sku,
                            currentStock: availableStock,
                            minStockRequired: p.minStockLevel,
                            pastVelocity: velocity,
                            suggestedRestockQty,
                            urgency: availableStock <= 0 ? 'CRITICAL' : (availableStock <= p.minStockLevel ? 'HIGH' : 'MEDIUM')
                        });
                    }
                }
            }

            recommendations.sort((a, b) => {
                const uMap = { 'CRITICAL': 3, 'HIGH': 2, 'MEDIUM': 1 };
                if (uMap[a.urgency as keyof typeof uMap] !== uMap[b.urgency as keyof typeof uMap]) {
                    return uMap[b.urgency as keyof typeof uMap] - uMap[a.urgency as keyof typeof uMap];
                }
                return b.pastVelocity - a.pastVelocity;
            });

            if (recommendations.length === 0) {
                return JSON.stringify({ message: "No restocking needed. All active products are adequately stocked against recent demand." });
            }

            return JSON.stringify({
                timeWindowDays: windowDays,
                totalProductsFlagged: recommendations.length,
                topRecommendations: recommendations.slice(0, limit)
            });
        }) as any,
    });
};
