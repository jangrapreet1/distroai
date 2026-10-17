#!/usr/bin/env bash
ssh -i ~/.ssh/oci.key opc@144.24.130.2 << 'EOF'
sudo docker exec distroai_postgres psql -U distroai -d distroai -c 'SELECT id, "poId", "orderedQty", "receivedQty", "deliveredQty", "pendingQty" FROM "PurchaseOrderItem";'
sudo docker exec distroai_postgres psql -U distroai -d distroai -c 'SELECT id, "orderId", quantity, "orderedQty", "deliveredQty", "pendingQty" FROM "OrderItem";'
EOF
