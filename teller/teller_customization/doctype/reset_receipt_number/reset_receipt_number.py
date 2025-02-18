# Copyright (c) 2024, Mohamed AbdElsabour and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class ResetReceiptNumber(Document):
    pass


@frappe.whitelist(allow_guest=True)
def test_reset_receipt():
    doc = frappe.get_doc("Teller Invoice", "Teller-Sales-Invoice_0077")
    return doc
