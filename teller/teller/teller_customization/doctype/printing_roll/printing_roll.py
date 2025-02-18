# Copyright (c) 2024, Mohamed AbdElsabour and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import nowdate


class PrintingRoll(Document):

    def before_save(self):
        # Validate end count is greater than start count
        if self.end_count <= self.start_count:
            frappe.throw("End Count must be greater than Start Count")
            
        # Initialize last_printed_number if not set
        if not self.last_printed_number:
            self.last_printed_number = self.start_count - 1  # Start from one less than start_count
            
        # Update show_number to reflect the number of digits in the current number
        self.show_number = len(str(self.last_printed_number or self.start_count))

        # self.last_printed_number = self.start_count
        # str_lst = str(self.last_printed_number)
        # len_of_last_number = len(str_lst)
        # self.show_number = len_of_last_number
