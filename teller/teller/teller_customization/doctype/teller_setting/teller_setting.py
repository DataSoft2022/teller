# Copyright (c) 2024, Mohamed AbdElsabour and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document
import frappe


class TellerSetting(Document):
    # treasury = frappe.get_single_value("Teller Setting", "treasury_code")
    # frappe.db.set_value('Teller Purchase','treasury', treasury)

    # print(treasury)
    pass


@frappe.whitelist(allow_guest=True)
def rate_settings(currency):
    selling_rate = frappe.db.get_value(
        "Currency Exchange", {"from_currency": currency}, "custom_selling_exchange_rate"
    )

    return selling_rate

@frappe.whitelist(allow_guest=True)
def purchase_rate_settings(currency):
    purchase_rate = frappe.db.get_value(
        "Currency Exchange", {"from_currency": currency}, "exchange_rate"
    )

    return purchase_rate

