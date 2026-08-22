"""Tests RNOS-25 — Order/Invoice schema extension gate artifacts."""

from __future__ import annotations

import unittest
from pathlib import Path


class TestRnos25OrderInvoice(unittest.TestCase):
    def test_gate_artifacts_present(self):
        root = Path(__file__).resolve().parents[1]
        required = [
            "services/ptt-crm-api/src/billing/billing-schema.util.ts",
            "services/ptt-crm-api/src/orders/orders.service.ts",
            "services/ptt-crm-api/src/invoices/invoices.service.ts",
            "services/ops-web/src/app/crm/orders/OrdersContent.tsx",
            "services/ops-web/e2e/order-invoice-rnos25.spec.ts",
            "scripts/rnos25_order_invoice_gate.sh",
        ]
        for rel in required:
            self.assertTrue((root / rel).is_file(), rel)

    def test_ops_nav_wires_orders_invoices(self):
        nav = (Path(__file__).resolve().parents[1] / "services/ops-web/src/components/OpsNav.tsx").read_text(
            encoding="utf-8"
        )
        self.assertIn("/crm/orders", nav)
        self.assertIn("/crm/invoices", nav)


if __name__ == "__main__":
    unittest.main()
