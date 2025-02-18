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
      interbank_list = self.deals
      list_table = []

      if interbank_list:
          for curr in interbank_list:
              if curr.get("qty") and curr.get("qty") > 0:
                  list_table.append(
                      {
                          "currency": curr.get("currency"),
                          "transaction": curr.get("transaction"),
                          "qty": curr.get("qty"),
                          "rate": curr.get("rate"),
                      }
                  )

          print("booked_currency :", list_table)
          if list_table:  # Ensure there's data to append
                  document = frappe.new_doc("Request interbank")
                  document.user = current_doc.user
                  document.branch = current_doc.branch
                  document.date = current_doc.date
                  document.time = current_doc.time
                  document.customer = current_doc.customer
                  document.request_deal_interbank_refrence = current_doc.name
                  for book in list_table:
                      document.append(
                          "items",
                          {
                              "currency": book.get("currency"),
                              "curency_code":book.get("currency_code"),
                              "qty": book.get("qty"),
                              # "rate": book.get("rate"),
                          },
                      )

                  document.insert(ignore_permissions=True)  # Save the document
                  frappe.db.commit()  # Commit the transaction

                  return _("Special Price Document(s) created successfully!")

          return _("No valid entries to create Special Price Document.")

