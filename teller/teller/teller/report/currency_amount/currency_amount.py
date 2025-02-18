# Copyright (c) 2024, Mohamed AbdElsabour and contributors
# For license information, please see license.txt

# import frappe


# def execute(filters=None):
#     columns = get_columns()
#     data = get_data(filters)
#     return columns, data

# def get_columns():
#     columns = [
#         {
#             "fieldname": "company",
#             "label": _("Company"),
#             "fieldtype": "Link",
#             "options": "Company",
#             "default": frappe.defaults.get_user_default("Company"),
#         },
#         {
#             "fieldname": "name",
#             "label": _("Account"),
#             "fieldtype": "Link",
#             "options": "Account",
#             "width": 300,
#         },
#         {
#             "fieldname": "balance",
#             "label": _("Balance"),
#             "fieldtype": "Currency",
#             "width": 150,
#         },
#     ]
#     return columns



# def get_data(filters):
# 	conditions = []
#     parameters = {}

#     # Add conditions based on filters
#     company = filters.get("company")
#     name = filters.get("name")

#     if company:
#         conditions.append("company = %(company)s")
#         parameters["company"] = company
#     if name:
#         conditions.append("name = %(name)s")
#         parameters["name"] = name
# 	sql = """
# 		SELECT account,account_currency, SUM(debit_in_account_currency) - SUM(credit_in_account_currency) AS net_balance
# 		FROM `tabGL Entry`

# 		GROUP BY `account`, `account_currency`;

# 		"""
# 	data = frappe.db.sql(sql, parameters, as_dict=True)
# import frappe
# from frappe import _

# def execute(filters=None):
#     columns = get_columns()
#     data = get_data(filters)
#     return columns, data

# def get_columns():
#     columns = [
#         {
#             "fieldname": "company",
#             "label": _("Company"),
#             "fieldtype": "Link",
#             "options": "Company",
#             "default": frappe.defaults.get_user_default("Company"),
#         },
#         {
#             "fieldname": "name",
#             "label": _("Account"),
#             "fieldtype": "Link",
#             "options": "Account",
#             "width": 300,
#         },
#         {
#             "fieldname": "balance",
#             "label": _("Balance"),
#             "fieldtype": "Currency",  # Changed to Currency for proper formatting
#             "width": 150,
#         },
#         {
#             "fieldname": "account_currency",
#             "label": _("Currency"),
#             "fieldtype": "Data",  # Changed to Data as Currency is not appropriate here
#             "width": 150,
#         },
#     ]
#     return columns

# def get_data(filters):
#     conditions = []
#     parameters = {}

#     # Add conditions based on filters
#     account_currency = filters.get("account_currency")
#     account = filters.get("name")
    
#     if account_currency:
#         conditions.append("account_currency = %(account_currency)s")
#         parameters["account_currency"] = account_currency
#         conditions.append("name = %(account)s")
#         parameters["account"] = account

#     # Build the WHERE clause
#     where_clause = ""
#     if conditions:
#         where_clause = "WHERE " + " AND ".join(conditions)
#     print("where_clausewhereaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",where_clause)
#     sql = f"""
#         SELECT
#             company,
#             account AS name,
#             account_currency,
#             SUM(debit_in_account_currency) - SUM(credit_in_account_currency) AS balance
#         FROM `tabGL Entry`
#         {where_clause}
#         GROUP BY company, account, account_currency;
#     """

#     # Execute the query and fetch data
#     data = frappe.db.sql(sql, parameters, as_dict=True)
#     return data

import frappe
from frappe import _

def execute(filters=None):
    columns = get_columns()
    data = get_data(filters)
    return columns, data

def get_columns():
    columns = [
        {
            "fieldname": "company",
            "label": _("الشركـة"),
            "fieldtype": "Link",
            "options": "Company",
            "default": frappe.defaults.get_user_default("Company"),
        },
        {
            "fieldname": "name",
            "label": _("الفــرع"),
            "fieldtype": "Link",
            "options": "Account",
            "width": 300,
        },
        {
            "fieldname": "balance",
            "label": _("الرصـــيد"),
            "fieldtype": "Data",
            "width": 150,
        },
        {
            "fieldname": "account_currency",
            "label": _("Currency"),
            "fieldtype": "Data",
            "width": 150,
        },
    ]
    return columns

def get_data(filters):
    conditions = []
    parameters = {}

    # Add conditions based on filters
    account_currency = filters.get("account_currency")

    account = filters.get("name")
    
  
    
    if account:
        conditions.append("account = %(account)s")
        parameters["account"] = account
        print("Elseeeeee",conditions)
    
    # Build the WHERE clause
        where_clause = ""
        print("Consitionsssssssssssss",conditions)
        if conditions:
            where_clause = "WHERE " + " AND ".join(conditions)

        sql = f"""
            SELECT
                company,
                account AS name,
                account_currency,
                SUM(debit_in_account_currency) - SUM(credit_in_account_currency) AS balance
            FROM `tabGL Entry`
            {where_clause}
            GROUP BY company, account, account_currency;
        """

        # Execute the query and fetch data
        data = frappe.db.sql(sql, parameters, as_dict=True)
        return data
    else:
        sql = f"""
            SELECT
                company,
                account AS name,
                account_currency,
                SUM(debit_in_account_currency) - SUM(credit_in_account_currency) AS balance
            FROM `tabGL Entry`
            GROUP BY company, account, account_currency;
        """

        # Execute the query and fetch data
        data = frappe.db.sql(sql, as_dict=True)
        return data              