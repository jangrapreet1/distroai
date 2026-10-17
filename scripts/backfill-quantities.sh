#!/usr/bin/env bash
ssh -i ~/.ssh/oci.key opc@144.24.130.2 << 'EOF'
sudo docker exec distroai_postgres psql -U distroai -d distroai -c 'UPDATE "PurchaseOrderItem" SET "pendingQty" = "orderedQty" - "receivedQty" WHERE "pendingQty" = 0 AND "orderedQty" > "receivedQty";'
sudo docker exec distroai_postgres psql -U distroai -d distroai -c 'UPDATE "OrderItem" SET "orderedQty" = quantity, "pendingQty" = quantity - "deliveredQty" WHERE "orderedQty" = 0;'
sudo docker exec distroai_postgres psql -U distroai -d distroai -c 'SELECT id, "poId", "orderedQty", "receivedQty", "deliveredQty", "pendingQty" FROM "PurchaseOrderItem";'
sudo docker exec distroai_postgres psql -U distroai -d distroai -c 'SELECT id, "orderId", quantity, "orderedQty", "deliveredQty", "pendingQty" FROM "OrderItem";'
EOF
