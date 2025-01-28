# Copyright (c) 2024, Mohamed AbdElsabour and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class InterBankDetails(Document):
	@frappe.whitelist(allow_guest=True)
	def sendmail(self):
		str_value = self.booking_precentage
		percentage = float(str_value.replace('%', ''))
		allow_notify = frappe.db.get_singles_value("Teller Setting", "allow_interbank_notification")
		if allow_notify == "ON":
			notify = frappe.db.get_singles_value("Teller Setting", "notification_percentage")
			print(f"n\n\n\n notify{notify} precent ib {percentage}")
			print(f"n\n\n\n notify{type(notify)} precent ib {type(percentage)}")
