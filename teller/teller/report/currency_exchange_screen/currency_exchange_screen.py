# Copyright (c) 2025, Mohamed AbdElsabour and contributors
# For license information, please see license.txt

import frappe
from teller.teller_customization.doctype.update_currency_exchange.update_currency_exchange import UpdateCurrencyExchange

def execute(filters=None):
	columns = get_columns()
	data = get_data()
	return columns, data

def get_columns():
	 return [
        {"label": "Currency", "fieldname": "from_currency", "fieldtype": "Data", "width": 150},
        {"label": "Exchange Rate", "fieldname": "exchange_rate", "fieldtype": "Float", "width": 150},
        {"label": "Selling Exchange Rate", "fieldname": "custom_selling_exchange_rate", "fieldtype": "Float", "width": 200},
        {"label": "Last Date", "fieldname": "latest_date", "fieldtype": "Date", "width": 150},
        
        
  ]
def get_data():
    x=UpdateCurrencyExchange.fetch_currency_rates(self=None)
    data = []
    for rate in x: 
        data.append({
            "currency": rate.get("currency"),
            "exchange_rate": rate.get("rate"),
            "date": rate.get("date")
        })
    print(f" {x}")    
    return x