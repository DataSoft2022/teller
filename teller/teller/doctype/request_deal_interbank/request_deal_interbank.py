# Copyright (c) 2024, Mohamed AbdElsabour and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class RequestDealinterbank(Document):
  @frappe.whitelist()
  def creat_request_interbank(self):
      # Create Request interbank
      current_doc = frappe.get_doc("Request Deal interbank", self.name)
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
                  document = frappe.new_doc("Request interbank")
                  document.user = current_doc.user
                  document.branch = current_doc.branch
                  document.date = current_doc.date
                  document.time = current_doc.tme
                  document.request_deal_interbank_refrence = current_doc.name
                  for book in list_table:
                      document.append(
                          "interbank",
                          {
                              "currency": book.get("currency"),
                              "custom_currency_code":book.get("custom_currency_code"),
                              "custom_qty": book.get("custom_qty"),
                              # "rate": book.get("rate"),
                          },
                      )

                  document.insert(ignore_permissions=True)  # Save the document
                  frappe.db.commit()  # Commit the transaction

                  return _("Special Price Document(s) created successfully!")

          return _("No valid entries to create Special Price Document.")

