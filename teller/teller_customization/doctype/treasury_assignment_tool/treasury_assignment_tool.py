# Copyright (c) 2025, Mohamed AbdElsabour and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe import whitelist
import json
class TreasuryAssignmentTool(Document):
    pass
@whitelist()
def assign_to_trasury(self):
    doc = json.loads(self)
    
    frappe.msgprint("hello")
    doc_user_permission = frappe.get_doc({
        "doctype":"User Permission",
        "user":doc.get("user"),
        "allow":"Teller Treasury",
        "for_value":doc.get("teller_treasury"),
    })
    doc_user_permission.insert()

