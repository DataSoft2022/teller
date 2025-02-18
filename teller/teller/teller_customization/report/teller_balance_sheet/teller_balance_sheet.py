
# Copyright (c) 2024, Mohamed AbdElsabour and contributors
# For license information, please see license.txt

import frappe
from frappe import _


def execute(filters=None):
    # Get columns
    columns = get_columns()
    # Get filters
    filter_account = filters.get("account")
    # filter_currency = filters.get("account_currency")
    filter_currencies = filters.get("account_currency", [])

    filter_from_date = filters.get("from_date")
    # filter_to_date = filters.get("to_date")
    conditions = []
    if filter_account:
        conditions.append(f"parent_account LIKE '%{filter_account}%'")
    if filter_currencies:
        currency_conditions = ', '.join([f"'{currency}'" for currency in filter_currencies])
        conditions.append(f"account_currency IN ({currency_conditions})")

    where_clause = " AND ".join(conditions) if conditions else "1=1"


    sql_query = f"""
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
            account IN (SELECT name FROM `tabAccount` WHERE account_type = 'Cash' AND {where_clause})
        GROUP BY
            account, account_currency
    """

    try:
        data = frappe.db.sql(sql_query, as_dict=True)
    except frappe.exceptions.SQLError as e:
        frappe.log_error(frappe.get_traceback(), "ERPNext Script Report Error")
        data = []



    # Get chart data
    chart = {
        "data": {
            "labels": [d["account"] for d in data],
            "datasets": [
                {
                    "name": "Total Selling",
                    "values": [d["sum_currency_sale"] for d in data],
                },
                {
                    "name": "Total Purchasing",
                    "values": [d["sum_currency_purchase"] for d in data],
                },
            ],
        },
        "type": "bar",  # Can be "line", "scatter", "pie", "percentage","bar"
        "height": 300,
    }
    # Calculate summary data
    total_sales = sum(d["sum_egy_sale"] for d in data)
    total_purchases = sum(d["sum_egy_purchase"] for d in data)

    report_summary = [
        {
            "value": total_sales + total_purchases,
            "indicator": "Yellow",
            "label": _("Total Currencies"),
        },
        {
            "value": total_sales,
            "indicator": "Blue",
            "label": _("Total Currencies Sales"),
        },
        {
            "value": total_purchases,
            "indicator": "Green",
            "label": _("Total Currencies Purchases"),
        },
    ]
    return columns, data, None, chart, report_summary
    # return {"columns": columns, "result": data, "chart": chart}

# define columns
def get_columns():
    return [
        {
            "label": _("Account"),
            "fieldname": "account",
            "fieldtype": "Link",
            "options": "Account",
            "width": 120,
        },
        {
            "label": _("Total Selling"),
            "fieldname": "sum_currency_sale",
            "fieldtype": "Currency",
            "width": 150,
        },
        {
            "label": _("Total Purchasing"),
            "fieldname": "sum_currency_purchase",
            "fieldtype": "Currency",
            "width": 150,
        },
        {
            "label": _("Currency"),
            "fieldname": "account_currency",
            "fieldtype": "Link",
            "options": "Currency",
            "width": 150,
        },
        {
            "label": _("Egy Selling"),
            "fieldname": "sum_egy_sale",
            "fieldtype": "Currency",
            "width": 150,
        },
        {
            "label": _("Egy Purchasing"),
            "fieldname": "sum_egy_purchase",
            "fieldtype": "Currency",
            "width": 150,
        },
        {
            "label": _("Posting Date"),
            "fieldname": "posting_date",
            "fieldtype": "Date",
            "width": 150,
        },
    ]
