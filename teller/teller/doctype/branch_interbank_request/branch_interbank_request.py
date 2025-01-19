# Copyright (c) 2025, Mohamed AbdElsabour and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class BranchInterbankRequest(Document):
    def on_submit(self):
      if not self.branch_request_details:
          frappe.throw("Table is Empty")
      for row in self.branch_request_details:
        if not row.qty or row.qty == 0:
          frappe.throw(f" Row {row.idx}# can't be rate {row.qty}")
      self.create_booking()
    def create_booking(self):
        frappe.msgprint(f"booking....")  