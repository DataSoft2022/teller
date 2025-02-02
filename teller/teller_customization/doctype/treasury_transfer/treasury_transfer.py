# Copyright (c) 2025, Mohamed AbdElsabour and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class TreasuryTransfer(Document):
	def on_submit(self):
		  if self.amount and self.from_treasury and self.from_treasury:
			  	pass
          # account_from = get_doc(
          #     {
          #         "doctype": "GL Entry",
          #         "posting_date": nowdate(),
          #         "account": row.paid_from,
          #         "debit": 0,
          #         "credit": row.total_amount,
          #         "credit_in_account_currency": row.usd_amount,
          #         "remarks": f"Amount {row.currency} {row.usd_amount} transferred from {row.paid_from} to {self.egy}",
          #         "voucher_type": "Teller Invoice",
          #         "voucher_no": self.name,
          #         "against": self.egy,
          #         # "cost_center": row.cost_center,
          #         # "project": row.project,
          #         "credit_in_transaction_currency": row.total_amount,
          #     }
          # )
          # # account_from.insert(ignore_permissions=True).submit()

          # # account_to = get_doc(
          # #     {
          # #         "doctype": "GL Entry",
          # #         "posting_date": nowdate(),
          # #         "account": self.egy,
          # #         "debit": row.total_amount,
          # #         "credit": 0,
          # #         "debit_in_account_currency": row.total_amount,
          # #         "credit_in_account_currency": 0,
          # #         "remarks": f"Amount {row.currency} {row.usd_amount} transferred from {row.paid_from} to {self.egy}",
          # #         "voucher_type": "Teller Invoice",
          # #         "voucher_no": self.name,
          # #         "against": row.paid_from,
          # #         # "cost_center": row.cost_center,
          # #         # "project": row.project,
          # #         "debit_in_transaction_currency": row.total_amount,
          # #         "credit_in_transaction_currency": 0,
          # #     }
          # # )
          # # account_to.insert(ignore_permissions=True).submit()
