# Copyright (c) 2025, Mohamed AbdElsabour and contributors
# For license information, please see license.txt

import frappe
from frappe import whitelist
from frappe.model.document import Document


class OpenShiftforBranch(Document):
    def before_save(self):
        self.current_user = frappe.session.user

@whitelist()
def get_user_id(branch):
    users = frappe.db.get_list("Employee", {"branch": branch},["user_id"])
    if users:
      # active_open_shift_name = user[0]["name"]
      return users
