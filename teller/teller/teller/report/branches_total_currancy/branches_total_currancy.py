

# import frappe
# from frappe import _
# # from erpnext.accounts.utils import get_balance_on
# # from frappe.utils import today

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
#             "fieldname": "account_currency",
#             "label": _("Cuurency for all branches "),

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
#     conditions = []
#     parameters = {}

#     # # Add conditions based on filters
#     # company = filters.get("company")
#     # name = filters.get("name")

#     # if company:
#     #     conditions.append("company = %(company)s")
#     #     parameters["company"] = company
#     # if name:
#     #     conditions.append("name = %(name)s")
#     #     parameters["name"] = name

#     # # Construct the SQL query with conditions
#     # condition_str = " AND ".join(conditions)
#     # if condition_str:
#     #     condition_str = "WHERE " + condition_str
#     print("filters",filters)
#     print("filters.gets",filters.get("account_currency"))
#     if not filters.get("account_currency"):
#         query = f"""
#             select company,account_currency,SUM(debit_in_account_currency) - SUM(credit_in_account_currency) AS balance
#             from `tabGL Entry`  GROUP BY account_currency;
                
            
#         """
        
#         # Execute the query and fetch data
#         data = frappe.db.sql(query, as_dict=True)
#         return data
#     else:
#         account_currency =filters.get("account_currency")
#         conditions.append("account_currency = %(account_currency)")
#         parameters["account_currency"] =account_currency
#           # # Construct the SQL query with conditions
#         condition_str = " AND ".join(conditions)
#         if condition_str:
#             condition_str = "WHERE " + condition_str

#             query = f"""
#                 select company,account_currency,SUM(debit_in_account_currency) - SUM(credit_in_account_currency) AS balance
#                 from `tabGL Entry` {condition_str};
                    
                
#             """
        
#             # Execute the query and fetch data
#             data = frappe.db.sql(query,parameters, as_dict=True)
#             return data
#         # # Fetch balances if company and account are provided
#         # if company and name:
#         #     # Fetch the balance as a dictionary (or adjust if `get_balance_on` returns a single balance)
#         #     balances = get_balance_on(account=name, date=today(), company=company)
#         #     for record in data:
#         #         # Check if balances is a dictionary or a single value
#         #         if isinstance(balances, dict):
#         #             # Add balance to the record; assuming balances is a dictionary with account names as keys
#         #             record['balance'] = balances.get(record['name'], 0)
#         #         else:
#         #             # Handle case where balances is a single float value
#         #             record['balance'] = balances if record['name'] == name else 0

    


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
            "label": _("Company"),
            "fieldtype": "Link",
            "options": "Company",
            "default": frappe.defaults.get_user_default("Company"),
        },
        {
            "fieldname": "account_currency",
            "label": _("Currency for all branches"),
            "fieldtype": "Select",  # Ensure fieldtype is defined
            "width": 300,
        },
        {
            "fieldname": "balance",
            "label": _("Balance"),
            "fieldtype": "Data",
            "width": 150,
        },
    ]
    return columns

def get_data(filters):
    conditions = []
    parameters = {}

    # Debugging prints
    print("filters:", filters)
    print("filters.get('account_currency'):", filters.get("account_currency"))
    
    if not filters.get("account_currency"):
        query = """
            SELECT company, account_currency, SUM(debit_in_account_currency) - SUM(credit_in_account_currency) AS balance
            FROM `tabGL Entry`
            GROUP BY company, account_currency
        """
        # Execute the query and fetch data
        data = frappe.db.sql(query, as_dict=True)
    else:
        account_currency = filters.get("account_currency")
        conditions.append("account_currency = %(account_currency)s")
        parameters["account_currency"] = account_currency
        
        # Construct the SQL query with conditions
        condition_str = " AND ".join(conditions)
        if condition_str:
            condition_str = "WHERE " + condition_str

        query = f"""
            SELECT company, account_currency, SUM(debit_in_account_currency) - SUM(credit_in_account_currency) AS balance
            FROM `tabGL Entry`
            {condition_str}
            GROUP BY company, account_currency
        """
        # Execute the query and fetch data
        data = frappe.db.sql(query, parameters, as_dict=True)
    
    return data
