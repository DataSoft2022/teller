# Copyright (c) 2024, Mohamed AbdElsabour and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import nowdate,nowtime


class UpdateCurrencyExchange(Document):
    lset = []

    def fetch_currency_rates(self):
        # Define the custom currency order
        currency_order = """
        CASE from_currency
            WHEN 'USD' THEN 1
            WHEN 'EUR' THEN 2
            WHEN 'GBP' THEN 3
            WHEN 'CAD' THEN 4
            WHEN 'DKK' THEN 5
            WHEN 'NOK' THEN 6
            WHEN 'SEK' THEN 7
            WHEN 'CHF' THEN 8
            WHEN 'JPY' THEN 9
            WHEN 'AUD' THEN 10
            WHEN 'KWD' THEN 11
            WHEN 'SAR' THEN 12
            WHEN 'AED' THEN 13
            WHEN 'BHD' THEN 14
            WHEN 'OMR' THEN 15
            WHEN 'QAR' THEN 16
            WHEN 'JOD' THEN 17
            WHEN 'CNY' THEN 18
            ELSE 100
        END
        """
        
        rates = frappe.db.sql(
            f"""
            SELECT 
                t1.from_currency, 
                t1.creation as latest_date, 
                t1.exchange_rate, 
                t1.custom_selling_exchange_rate,
                t1.creation as last_update
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
            INNER JOIN `tabCurrency` c
            ON t1.from_currency = c.name
            WHERE c.enabled = 1
            ORDER BY {currency_order}
            """,
            as_dict=True,
        )
        return rates

    @frappe.whitelist()
    
    def set_currency_rates(self):
      if not self.exchange_records:
        for d in self.fetch_currency_rates():
            self.append(
                "exchange_records",
                {
                    "from_currency": d.from_currency,
                    "purchase_exchange_rate": d.exchange_rate,
                    "selling_exchange_rate": d.custom_selling_exchange_rate,
                    "last_update": d.last_update
                },
            )
            
              

    @frappe.whitelist()
    def update_currency(self, from_currency, purchase_rate, selling_rate):

        egy_currency = "EGP"

        new_rate = frappe.get_doc(
            {
                "doctype": "Currency Exchange",
                "from_currency": from_currency,
                "to_currency": egy_currency,
                "exchange_rate": purchase_rate,
                "custom_selling_exchange_rate": selling_rate,
                "date": nowdate(),
                "custom_posting_time":nowtime()
            }
        )

        new_rate.insert()
        frappe.db.commit()
        return new_rate


@frappe.whitelist(allow_guest=True)
def fetch_currency_rates1():
    rates = frappe.get_all("Currency Exchange", fields=["*"])
    return rates



@frappe.whitelist(allow_guest=True)
def fetch_currency_rates_sql():
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
            AND t1.creation = t2.latest_date;
       
        """,
        as_dict=True,
    )
    return rates
