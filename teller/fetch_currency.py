import frappe

from frappe import _
import json


@frappe.whitelist()
def fetch(docname):

    query = """
        SELECT cu.custom_currency_code,ac.account_currency, 
       SUM(gl.debit_in_account_currency) - SUM(gl.credit_in_account_currency) AS balance
        FROM `tabGL Entry` AS gl
        INNER JOIN `tabAccount` AS ac
        ON ac.name = gl.account
        INNER JOIN `tabCurrency` AS cu
        ON cu.name = ac.account_currency
        WHERE ac.custom_is_treasury = 1
        AND ac.account_currency != 'EGP'
        GROUP BY ac.account_currency;
    """
    data = frappe.db.sql(query, as_dict=True)
    doc = frappe.get_doc("InterBank", docname)
    doc.set("interbank", [])
    for record in data:
        doc.append(
            "interbank",
            {
                "custom_currency_code": record["custom_currency_code"],
                "currency": record["account_currency"],
                "amount": record["balance"],
            },
        )
    # doc.insert()
    doc.save()
    frappe.db.commit()
    return data


@frappe.whitelist()
def create_special__pricedocument(list):
    # Convert the JSON string to a Python dictionary
    list = json.loads(list)

    document = frappe.get_doc(
        {"doctype": "Special price document", "booked_currency": list}
    )

    document.insert(ignore_permissions=True)
    document.save()
