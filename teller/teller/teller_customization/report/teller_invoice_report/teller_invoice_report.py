# Copyright (c) 2024, Mohamed AbdElsabour and contributors
# For license information, please see license.txt

from frappe import _
import frappe


def execute(filters=None):
    invoice_name = filters.get("name") if filters else None
    shift_name = filters.get("shift") if filters else None

    columns = [
        {
            "label": _("Reference"),
            "fieldname": "name",
            "fieldtype": "Link",
            "options": "Teller Invoice",
            "width": 150,
        },
        {
            "label": _("Receipt Number"),
            "fieldname": "receipt_number",
            "fieldtype": "Data",
            "width": 150,
        },
        {
            "label": _("Posting Date"),
            "fieldname": "date",
            "fieldtype": "Date",
            "width": 150,
        },
        {
            "label": _("Current Roll"),
            "fieldname": "current_roll",
            "fieldtype": "Link",
            "options": "Printing Roll",
            "width": 150,
        },
        {
            "label": _("Shift"),
            "fieldname": "shift",
            "fieldtype": "Data",
            "width": 150,
        },
        {
            "label": _("Invoice Total"),
            "fieldname": "total",
            "fieldtype": "Currency",
            "width": 150,
            "precision": 2,  
        },
    ]

    sql = """
        SELECT t.name, t.receipt_number, t.date, t.current_roll, t.shift, t.total
        FROM `tabTeller Invoice` AS t
        WHERE (%(invoice_name)s IS NULL OR t.name LIKE %(invoice_name)s)
        AND (%(shift_name)s IS NULL OR t.shift LIKE %(shift_name)s)
    """

    data = frappe.db.sql(
        sql,
        {
            "invoice_name": f"%{invoice_name}%" if invoice_name else None,
            "shift_name": f"%{shift_name}%" if shift_name else None,
        },
        as_dict=True,
    )

    chart = {
        "data": {
            "labels": [d["name"] for d in data],
            "datasets": [
                {"name": "Invoice Total", "values": [d["total"] for d in data]}
            ],
        },
        "type": "line",
    }

    return columns, data, None, chart
