# Copyright (c) 2024, Mohamed AbdElsabour and contributors
# For license information, please see license.txt
import frappe
from frappe.model.document import Document
from frappe import _
import json


class InterBank(Document):
    # @frappe.whitelist()
    # def fetch_data(self):
    #     # Your logic to fetch data
    #     sql = """
    # 	   SELECT
    #         account,
    #         SUM(credit_in_account_currency) AS sum_currency_sale,
    #         SUM(debit_in_account_currency) AS sum_currency_purchase,
    #         account_currency,
    #         SUM(credit) AS sum_egy_sale,
    #         SUM(debit) AS sum_egy_purchase,
    #         posting_date
    #     FROM
    #         `tabGL Entry`
    #     WHERE
    #         account IN (SELECT name FROM `tabAccount` WHERE account_type = 'Cash')

    # 	"""

    #     sr = frappe.db.sql(sql, as_dict=True)
    #     fetched_data = sr  # Replace with actual fetched data
    #     return fetched_data

    @frappe.whitelist()
    def get_currency(self):
        doc = frappe.get_doc("InterBank", self.name)

        query = """
            SELECT
              cu.custom_currency_code,ac.account_currency, 
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
        doc = frappe.get_doc("InterBank", self.name)
        doc.set("interbank", [])
        for record in data:
            doc.append(
                "interbank",
                {
                    "custom_currency_code": record["custom_currency_code"],
                    "currency": record["account_currency"],
                    "remaining": record["balance"],
                    "amount": record["balance"],
                },
            )
        # doc.insert()
        doc.save()
        frappe.db.commit()
        return data

    @frappe.whitelist()
    def create_special_price_document(self):
        current_doc = frappe.get_doc("InterBank", self.name)
        interbank_list = self.interbank
        list_table = []

        if interbank_list:
            for curr in interbank_list:
                if curr.get("custom_qty") and curr.get("custom_qty") > 0:
                    list_table.append(
                        {
                            "currency": curr.get("currency"),
                            "transaction": curr.get("transaction"),
                            "custom_qty": curr.get("custom_qty"),
                            "rate": curr.get("rate"),
                        }
                    )

            print("booked_currency :", list_table)

            if list_table:  # Ensure there's data to append
                document = frappe.new_doc("Special price document")
                for book in list_table:
                    document.append(
                        "booked_currency",
                        {
                            "currency": book.get("currency"),
                            "transaction": book.get("transaction"),
                            "custom_qty": book.get("custom_qty"),
                            "rate": book.get("rate"),
                        },
                    )
                    for curr in interbank_list:
                        if curr.get("custom_qty"):
                            # if curr.get("remaining")> 0 or curr.get("remaining") < 0:
                            curr.set("remaining", curr.get("remaining")- curr.get("custom_qty"))
                            curr.set("custom_qty", 0)
                            return current_doc.name
                            current_doc.save()
                        if curr.get("remaining") == 0:
                            # curr.set("remaining", (curr.get("remaining")- curr.get("custom_qty")*-1))
                            # curr.set("custom_qty", 0)
                            current_doc.save()
                            frappe.msgprint('you can not book now ')
                            break
                                  
                            
                            # list_table.append(
                            #     {
                            #         "currency": curr.get("currency"),
                            #         "transaction": curr.get("transaction"),
                            #         "custom_qty": 0,
                            #         "rate": curr.get("rate"),
                            #         "remaining":(curr.get("remaining")- curr.get("custom_qty"))
                            #     }
                            # )


                document.insert(ignore_permissions=True)  # Save the document
                frappe.db.commit()  # Commit the transaction

                return _("Special Price Document(s) created successfully!")

        return _("No valid entries to create Special Price Document.")
