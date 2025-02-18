# Copyright (c) 2025, Mohamed AbdElsabour and contributors
# For license information, please see license.txt

import frappe
@frappe.whitelist()
def get_data():
    rates = frappe.db.sql(
        """
  SELECT 
    t1.from_currency, 
    t1.creation as latest_date, 
    t1.exchange_rate, 
    t1.custom_selling_exchange_rate
  FROM 
    `tabCurrency Exchange` t1
  INNER JOIN (
    SELECT 
      from_currency, 
      MAX(creation) as latest_date
    FROM 
      `tabCurrency Exchange`
    GROUP BY 
      from_currency
  ) t2 
  ON 
    t1.from_currency = t2.from_currency 
    AND t1.creation = t2.latest_date
    WHERE t1.from_currency NOT IN ('EGP')
    Order by latest_date DESC;
  """,
        as_dict=True,
    )
    return rates
# Function to trigger real-time updates when currency rates change
def notify_currency_update():
    data = get_data()
    frappe.publish_realtime("currency_update", data)

# Hook to trigger event on Currency Exchange Doctype
def after_insert(doc, method):
    notify_currency_update()

def on_update(doc, method):
    notify_currency_update()