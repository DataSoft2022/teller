# Copyright (c) 2024, Mohamed AbdElsabour and contributors
# For license information, please see license.txt
import frappe
from frappe.model.document import Document


class InterBank(Document):
    @frappe.whitelist()
    def fetch_data(self):
        # Your logic to fetch data
        sql = """
		   SELECT
            account,
            SUM(credit_in_account_currency) AS sum_currency_sale,
            SUM(debit_in_account_currency) AS sum_currency_purchase,
            account_currency,
            SUM(credit) AS sum_egy_sale,
            SUM(debit) AS sum_egy_purchase,
            posting_date
        FROM
            `tabGL Entry`
        WHERE
            account IN (SELECT name FROM `tabAccount` WHERE account_type = 'Cash')

		"""

        sr = frappe.db.sql(sql, as_dict=True)
        fetched_data = sr  # Replace with actual fetched data
        return fetched_data
