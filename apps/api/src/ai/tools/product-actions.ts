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
        description: `Look up a product's full details by SKU code, product name, or partial match. Returns MRP, selling price, purchase price, stock quantity, category, brand, HSN code, GST rate, and box size. Use this when the user asks about a specific product, scans a barcode, or sends a product image.`,
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
