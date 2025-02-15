from erpnext.setup.doctype.currency_exchange.currency_exchange import CurrencyExchange
import frappe
from frappe.utils import nowdate, formatdate, get_datetime_str, cint


class CurrencyName(CurrencyExchange):



    def autoname(self):
        if not self.date:
            self.date = nowdate()

        # Generate the date-based prefix
        date_prefix = formatdate(get_datetime_str(self.date), "yyyy-MM-dd")
        
        # Generate the serial number for the day
        existing_count = frappe.db.count(
            "Currency Exchange",
            filters={
                "date": self.date,
                "from_currency": self.from_currency
            }
        )
        serial_number = existing_count + 1  # Increment based on existing records
        
        # Format the name with date, from_currency, and serial number
        self.name = f"{date_prefix}-{self.from_currency}-{serial_number:03d}"


    # def autoname(self):
    #     return super().autoname()