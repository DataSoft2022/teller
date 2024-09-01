# Copyright (c) 2024, Mohamed AbdElsabour and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class OPenShift(Document):
    def before_save(self):
        self.current_user = frappe.session.user
