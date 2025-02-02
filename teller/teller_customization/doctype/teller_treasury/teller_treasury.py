# Copyright (c) 2025, Mohamed AbdElsabour and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class TellerTreasury(Document):
  # pass
	def before_insert(self):
		if self.treasury_code and self.branch:
			serial = f"{str(self.branch)}-{str(self.treasury_code)}"
			frappe.msgprint(f"serial {serial}")
			self.naming_series = str(serial)
#           self.name = f"{self.branch}-{self.treasury_code}"