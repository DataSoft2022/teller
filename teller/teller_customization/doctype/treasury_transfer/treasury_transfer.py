# Copyright (c) 2025, Mohamed AbdElsabour and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import (
    add_days,
    cint,
    cstr,
    flt,
    formatdate,
    get_link_to_form,
    getdate,
    nowdate,
)

class TreasuryTransfer(Document):
	def on_submit(self):
		  if self.amount and self.from_treasury and self.from_treasury:
			  	# pass
					account_from = frappe.get_doc({
						  "doctype": "GL Entry",
              "posting_date": nowdate(),
              "account": self.from_account,
              "credit": self.amount,
							"voucher_type": "Treasury Transfer",
							"voucher_no": self.name,
							"against": self.to_account,
              "credit_in_transaction_currency": self.amount,
          })
					account_from.insert(ignore_permissions=True).submit()
					account_to = frappe.get_doc(
              {
                  "doctype": "GL Entry",
                  "posting_date": nowdate(),
                  "account": self.to_account,
                  "debit": self.amount,
                  "credit": 0,
                  "debit_in_account_currency": self.amount,
                  "credit_in_account_currency": 0,
                  # "remarks": f"Amount {row.currency} {row.usd_amount} transferred from {row.paid_from} to {self.egy}",
                  "voucher_type": "Treasury Transfer",
                  "voucher_no": self.name,
                  "against": self.from_account,
                  # "cost_center": row.cost_center,
                  # "project": row.project,
                  "debit_in_transaction_currency": self.amount,
                  "credit_in_transaction_currency": 0,
              }
          )
					account_to.insert(ignore_permissions=True).submit()
