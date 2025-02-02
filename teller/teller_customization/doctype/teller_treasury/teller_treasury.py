# Copyright (c) 2025, Mohamed AbdElsabour and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class TellerTreasury(Document):
  pass
# 	def before_insert(self):
#       if self.branch and self.treasury_code:
#           self.name = f"{self.branch}-{self.treasury_code}"