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
#             "label": _("الشركـة"),
#             "fieldtype": "Link",
#             "options": "Company",
#             "default": frappe.defaults.get_user_default("Company"),
#         },
#         {
#             "fieldname": "name",
#             "label": _(" الفــرع الرئيســي"),
#             "fieldtype": "Link",
#             "options": "Account",
#             "width": 300,
#         },
#         {
#             "fieldname": "balance",
#             "label": _("الرصـــيد"),
#             "fieldtype": "Data",
#             "width": 150,
#         },
#         {
#             "fieldname": "account_currency",
#             "label": _("Currency"),
#             "fieldtype": "Data",
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
    
	
    
#     if account:
#         conditions.append("account = %(account)s")
#         parameters["account"] = account
#         print("Elseeeeee",conditions)
    
#     # Build the WHERE clause
#         where_clause = ""
#         print("Consitionsssssssssssss",conditions)
#         if conditions:
#             where_clause = "WHERE " + " AND ".join(conditions)

#         sql = f"""
#             SELECT
#                 company,
#                 account AS name,
#                 account_currency,
#                 SUM(debit_in_account_currency) - SUM(credit_in_account_currency) AS balance
#             FROM `tabGL Entry`
#             {where_clause}
#             GROUP BY company, account, account_currency;
#         """

#         # Execute the query and fetch data
#         data = frappe.db.sql(sql, parameters, as_dict=True)
#         return data
#     else:
# 		sql = f""" 
# 			SELECT
# 				ge.account,
# 				ge.account_currency,
# 				SUM(ge.debit_in_account_currency) - SUM(ge.credit_in_account_currency) AS balance,
# 				SUM(ge.debit) - SUM(ge.credit) AS balance2
# 				FROM
# 					`tabGL Entry` ge
# 				WHERE
# 					ge.account_currency = 'USD'
# 				GROUP BY
# 					ge.account,
# 					ge.account_currency;"""
#         # ## select account_name 
# 		# sql1 = """ """

# 		# sql2 = f"""
# 		# 		SELECT
# 		# 			ge.account,
# 		# 			ge.account_currency,
# 		# 			SUM(ge.debit_in_account_currency) - SUM(ge.credit_in_account_currency) AS balance,
# 		# 			SUM(ge.debit) - SUM(ge.credit) AS balance2
# 		# 		FROM
# 		# 			`tabGL Entry` ge

# 		# 		inner join `tabAccount`
# 		# 		on `tabAccount`.name = ge.account

# 		# 		WHERE
# 		# 			ge.account_currency = 'USD'
# 		# 		and tabAccount.parent_account = ""    
# 		# 		GROUP BY
# 		# 			ge.account,
# 		# 			ge.account_currency;
# 		# 		"""





# 		# sql1. ge.name = "خزنة مينا دولار - AE"

# 		# sql2.ge.account = "خزنة مينا دولار - AE"
	  
# 		# Execute the query and fetch data
# 		data = frappe.db.sql(sql, as_dict=True)
# 		return data              
    





# import frappe
# from frappe import _

# def execute(filters=None):
#     columns = get_columns()
#     data = get_data(filters)
#     return columns, data

# def get_columns():
#     return [
#         {
#             "fieldname": "company",
#             "label": _("الشركـة"),
#             "fieldtype": "Link",
#             "options": "Company",
#             "default": frappe.defaults.get_user_default("Company"),
#         },
#         {
#             "fieldname": "name",
#             "label": _(" الفــرع الرئيســي"),
#             "fieldtype": "Link",
#             "options": "Account",
#             "width": 300,
#         },
#         {
#             "fieldname": "balance",
#             "label": _("الرصـــيد"),
#             "fieldtype": "Data",
#             "width": 150,
#         },
#         {
#             "fieldname": "account_currency",
#             "label": _("Currency"),
#             "fieldtype": "Data",
#             "width": 150,
#         },
#     ]

# def get_data(filters):
#     # Initial conditions and parameters for the query
#     conditions = []
#     parameters = {}

#     # Get filter values
#     account_currency = filters.get("account_currency")
#     account = filters.get("name")

#     # Build conditions based on filters
#     if account:
#         conditions.append("ge.account_name = %(account)s")
#         parameters["account"] = account

#     if account_currency:
#         conditions.append("ge.account_currency = %(account_currency)s")
#         parameters["account_currency"] = account_currency

#     # Build the WHERE clause
#     where_clause = ""
#     if conditions:
#         where_clause = "AND " + " AND ".join(conditions)

#     # Define the SQL query with CTE
#     sql = f"""
#         WITH FilteredAccounts AS (
#             SELECT
#                 name,
#                 account_name,
#                 parent_account,
#                 account_currency,
#                 is_group
#             FROM
#                 `tabAccount`
#             WHERE
#                 parent_account = 'الخزنة الرئيسية - AE'
#                 AND is_group = 1
#         )
#         SELECT
#             ge.name AS account_name,
#             ge.parent_account,
#             ge.account_currency
#         FROM
#             `tabAccount` ge
#             JOIN FilteredAccounts fa
#             ON ge.parent_account = fa.name
#         WHERE
#             fa.is_group = 1
#             AND ge.account_currency = 'USD'
            
#     """

#     # Execute the initial query to get filtered accounts
#     data = frappe.db.sql(sql, parameters, as_dict=True)

#     result = []

#     # Iterate over each record to fetch corresponding GL Entry data
#     for recode in data:
#         sql2 = """
#             SELECT
#                 ge.account AS account_name,
#                 `tabAccount`.is_group,
#                 `tabAccount`.parent_account,
#                 ge.account_currency,
#                 SUM(ge.debit_in_account_currency) - SUM(ge.credit_in_account_currency) AS balance,
#                 SUM(ge.debit) - SUM(ge.credit) AS balance2
#             FROM
#                 `tabGL Entry` ge
#             INNER JOIN
#                 `tabAccount`
#                 ON `tabAccount`.name = ge.account
#             WHERE
#                 ge.account_currency = 'USD'
#                 AND `tabAccount`.name = %(account_name)s
#             GROUP BY
#                 ge.account,
#                 ge.account_currency
#         """

# 		"""
   
#         data3 = frappe.db.sql(sql3, as_dict=True)
# 		# data2 = frappe.db.sql(sql2, as_dict=True)
#         print("data4",data3)
#         # print("data2",data2)
# 		# for d in data4:
#         #     result.append(d)
#         # Execute the second query to get GL Entry data for each account
#     #     data2 = frappe.db.sql(sql3, {"account_name": recode["account_name"]}, as_dict=True)

#     # #     # Append the fetched data to the result list
#     #     for record in data2:
#     # #         # print(recode)
#     #         result.append(record)
#     # return result        
			
	
# import frappe
# from frappe import _

# def execute(filters=None):
#     columns = get_columns()
#     data = get_data(filters)
#     return columns, data

# def get_columns():
#     return [
#         {
#             "fieldname": "company",
#             "label": _("الشركـة"),
#             "fieldtype": "Link",
#             "options": "Company",
#             "default": frappe.defaults.get_user_default("Company"),
#         },
#         {
#             "fieldname": "branch",
#             "label": _(" الفــرع الرئيســي"),
#             "fieldtype": "Link",
#             "options": "Account",
#             "width": 300,
#         },
#         {
#             "fieldname": "balance",
#             "label": _("الرصـــيد"),
#             "fieldtype": "Data",
#             "width": 150,
#         },
#         {
#             "fieldname": "account_currency",
#             "label": _("Currency"),
#             "fieldtype": "Data",
#             "width": 150,
#         },
#     ]

# def get_data(filters):
#     # Initial conditions and parameters for the query
#     conditions = []
#     parameters = {}

#     # Get filter values

    

#     # Build conditions based on filters
#     branch = filters.get("branch")
#     account_currency = filters.get("account_currency")

#     print("branchbranchbranch",branch)   
#     print("filtersfiltersfilters",filters)   
#     if branch and account_currency:
#         # conditions.append("parent_account = %(branch)s")
#         conditions.append("`tabAccount`.parent_account = %(branch)s")
#         parameters["branch"] = branch
#         # conditions.append("`tabAccount`.parent_account = %(branch)s")
#         # parameters["branch"] = branch

#     # Build the WHERE clause
#     where_clause = ""
#     if conditions:
#         where_clause = " where " + " AND ".join(conditions)
#         print("conditions11",conditions)    
#     # Define the SQL query to get the list of accounts
#     sql = f"""
#        SELECT
#             `tabAccount`.name,
#             `tabAccount`.parent_account,
#             `tabAccount`.account_currency,
#             `tabAccount`.is_group
#         FROM
#             `tabAccount`
#          {where_clause}
           
   
#     """

#     # Execute the query to get accounts
#     # `tabAccount`.parent_account = 'الخزنة الرئيسية - AE'
#     data = frappe.db.sql(sql, parameters, as_dict=True)
#     print("conditions22",conditions)
#     print("parameters33",parameters)


#     result = []

#     # Iterate over each record to fetch corresponding GL Entry data
#     for record in data:
#     #     # Get balances for each account
#         if record.is_group == 1:
#             # result.append(record)
#             print("REC",record)
#             sql2 = """
#                     SELECT
#                         `tabAccount`.name AS branch,
#                         ge.account,
#                         `tabAccount`.parent_account,
#                         ge.account_currency,
#                         SUM(ge.debit_in_account_currency) - SUM(ge.credit_in_account_currency) AS balance,
#                         SUM(ge.debit) - SUM(ge.credit) AS balance2
#                     FROM
#                         `tabGL Entry` ge
#                     INNER JOIN
#                         `tabAccount`
#                     ON `tabAccount`.name = ge.account
#                     WHERE
#                         `tabAccount`.parent_account = %(account_name)s
#                     AND `tabAccount`.account_currency = 'USD'
#                     GROUP BY
#                         ge.account, ge.account_currency
#                     """

#             data2 = frappe.db.sql(sql2,{"account_name": record["name"]}, as_dict=True)
#             for entry in data2:
#                 result.append(entry)
#         if record.is_group == 0 and record.account_currency == 'USD':
#             sql2 = """
#                     SELECT
#                         `tabAccount`.name AS branch,
#                         ge.account,
#                         `tabAccount`.parent_account,
#                         ge.account_currency,
#                         SUM(ge.debit_in_account_currency) - SUM(ge.credit_in_account_currency) AS balance,
#                         SUM(ge.debit) - SUM(ge.credit) AS balance2
#                     FROM
#                         `tabGL Entry` ge
#                     INNER JOIN
#                         `tabAccount`
#                     ON `tabAccount`.name = ge.account
#                     WHERE
#                         `tabAccount`.parent_account = %(account_name)s
#                     AND `tabAccount`.account_currency = 'USD'
#                     GROUP BY
#                         ge.account, ge.account_currency
#                     """
#             data2 = frappe.db.sql(sql2,{"account_name": record["parent_account"]}, as_dict=True)
#             for entry in data2:
#                 result.append(entry)
#     return result

#######################################################################################################
import frappe
from frappe import _

def execute(filters=None):
    columns = get_columns()
    data = get_data(filters)
    return columns, data

def get_columns():
    return [
        {
            "fieldname": "company",
            "label": _("الشركـة"),
            "fieldtype": "Link",
            "options": "Company",
            "default": frappe.defaults.get_user_default("Company"),
        },
        {
            "fieldname": "branch",
            "label": _(" الفــرع الرئيســي"),
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

def get_data(filters):
    # Initial conditions and parameters for the query
    conditions = []
    parameters = {}
    conditions2 = []
    parameters2 = {}
    # Get filter values
    branch = filters.get("branch")
    account_currency = filters.get("account_currency")

    # Build conditions based on filters
    if branch:
        conditions.append("`tabAccount`.parent_account = %(branch)s")
        parameters["branch"] = branch
    
    if account_currency:
        conditions2.append("`tabAccount`.account_currency = %(account_currency)s")
        parameters2["account_currency"] = account_currency

    # Build the WHERE clause
    where_clause = ""
    if conditions:
        where_clause = " WHERE " + " AND ".join(conditions)

    # Define the SQL query to get the list of accounts
    sql = f"""
       SELECT
            `tabAccount`.name,
            `tabAccount`.parent_account,
            `tabAccount`.account_currency,
            `tabAccount`.is_group
        FROM
            `tabAccount`
         {where_clause}
    """

    # Execute the query to get accounts
    data = frappe.db.sql(sql, parameters, as_dict=True)

    result = []

    # Iterate over each record to fetch corresponding GL Entry data
    for record in data:
        print(record)
        if record.is_group == 1:
            sql2 = """
                    SELECT
                        `tabAccount`.name AS branch,
                        ge.account,
                        `tabAccount`.parent_account,
                        ge.account_currency,
                        SUM(ge.debit_in_account_currency) - SUM(ge.credit_in_account_currency) AS balance,
                        SUM(ge.debit) - SUM(ge.credit) AS balance2
                    FROM
                        `tabGL Entry` ge
                    INNER JOIN
                        `tabAccount`
                    ON `tabAccount`.name = ge.account
                    WHERE
                        `tabAccount`.parent_account = %(account_name)s
                    AND ge.account_currency = %(account_currency)s
                    GROUP BY
                        ge.account, ge.account_currency
                    """

            data2 = frappe.db.sql(sql2, {"account_name": record["name"], "account_currency": account_currency}, as_dict=True)
            result.extend(data2)
        
        elif record.is_group == 0 and record.account_currency == account_currency:
            sql2 = """
                    SELECT
                        `tabAccount`.name AS branch,
                        ge.account,
                        `tabAccount`.parent_account,
                        ge.account_currency,
                        SUM(ge.debit_in_account_currency) - SUM(ge.credit_in_account_currency) AS balance,
                        SUM(ge.debit) - SUM(ge.credit) AS balance2
                    FROM
                        `tabGL Entry` ge
                    INNER JOIN
                        `tabAccount`
                    ON `tabAccount`.name = ge.account
                    WHERE
                        `tabAccount`.parent_account = %(account_name)s
                    AND ge.account_currency = %(account_currency)s
                    GROUP BY
                        ge.account, ge.account_currency
                    """
            data2 = frappe.db.sql(sql2, {"account_name": record["parent_account"], "account_currency": account_currency}, as_dict=True)
            result.extend(data2)
    
    return result
