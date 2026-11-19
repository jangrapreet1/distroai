#!/usr/bin/env bash
ssh -o StrictHostKeyChecking=no distroai@116.202.29.65 << 'EOF'
echo "=== PRODUCTS ==="
docker exec -i distroai_postgres psql -U distroai -d distroai -c "SELECT id, \"orgId\", name, sku, \"sellingPrice\", \"purchasePrice\", \"hasVariants\" FROM \"Product\" WHERE id IN ('cmvl643ir00074obzo9kji0xj', 'cmvl8d7fo00174obzjzrlo1ga', 'cmvl65tq6000h4obz23tdpi4p');"

echo "=== INVENTORY (Base Product) ==="
docker exec -i distroai_postgres psql -U distroai -d distroai -c "SELECT id, \"orgId\", \"productId\", quantity, \"reservedQty\" FROM \"Inventory\" WHERE \"productId\" IN ('cmvl643ir00074obzo9kji0xj', 'cmvl8d7fo00174obzjzrlo1ga', 'cmvl65tq6000h4obz23tdpi4p');"

echo "=== PRODUCT VARIANTS ==="
docker exec -i distroai_postgres psql -U distroai -d distroai -c "SELECT id, \"productId\", name, sku, \"sellingPrice\", \"purchasePrice\" FROM \"ProductVariant\" WHERE \"productId\" IN ('cmvl643ir00074obzo9kji0xj', 'cmvl8d7fo00174obzjzrlo1ga', 'cmvl65tq6000h4obz23tdpi4p');"

echo "=== VARIANT INVENTORY ==="
docker exec -i distroai_postgres psql -U distroai -d distroai -c "SELECT vi.id, vi.\"variantId\", pv.name, vi.quantity, vi.\"reservedQty\" FROM \"VariantInventory\" vi JOIN \"ProductVariant\" pv ON vi.\"variantId\" = pv.id;"
EOF
