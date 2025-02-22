# Copyright (c) 2024, Mohamed AbdElsabour and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import nowdate


class PrintingRoll(Document):
    def validate(self):
        self.validate_sequence_uniqueness()
        self.validate_active_status()
        
    def validate_sequence_uniqueness(self):
        """Ensure the sequence range is unique across all printing rolls"""
        sequence = f"{self.starting_letters or ''}{self.start_count}"
        
        # Check if any other roll has overlapping sequence
        existing = frappe.db.sql("""
            SELECT name 
            FROM `tabPrinting Roll`
            WHERE name != %s
            AND starting_letters = %s
            AND (
                (start_count <= %s AND end_count >= %s)  -- New start within existing range
                OR (start_count <= %s AND end_count >= %s)  -- New end within existing range
                OR (start_count >= %s AND end_count <= %s)  -- Existing range within new range
            )
        """, (
            self.name or "New",
            self.starting_letters or "",
            self.start_count,
            self.start_count,
            self.end_count,
            self.end_count,
            self.start_count,
            self.end_count
        ))
        
        if existing:
            frappe.throw(f"Sequence {sequence} overlaps with existing printing roll {existing[0][0]}")
            
    def validate_active_status(self):
        """Ensure only one roll per branch can be active"""
        if self.active:
            active_roll = frappe.db.get_value("Printing Roll",
                {
                    "branch": self.branch,
                    "active": 1,
                    "name": ("!=", self.name or "New")
                },
                "name"
            )
            
            if active_roll:
                frappe.throw(f"Another printing roll {active_roll} is already active for branch {self.branch}")

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
