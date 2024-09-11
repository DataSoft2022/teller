import frappe
from frappe import _

@frappe.whitelist()
def fetch(docname):

    query = """
        SELECT ac.account_currency, SUM(gl.debit_in_account_currency) - SUM(gl.credit_in_account_currency) AS balance
        FROM `tabGL Entry` AS gl
        INNER JOIN `tabAccount` AS ac
        ON ac.name = gl.account
        WHERE ac.custom_is_treasury = 1
        GROUP BY ac.account_currency
    """ 
    data = frappe.db.sql(query, as_dict=True)
    doc = frappe.get_doc("InterBank", docname)
    doc.set("interbank", [])
    for record in data:
        doc.append("interbank", {
            'currency': record['account_currency'],
            'amount': record['balance']
        })
    doc.save()
    frappe.db.commit()
    return data
