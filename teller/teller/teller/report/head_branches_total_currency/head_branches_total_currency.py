import frappe
from frappe import _

def execute(filters=None):
    columns = get_columns()
    data = get_data(filters)
    processed_data = process_data(data1=data.get('data1', []), data2=data.get('data2', []), filters=filters)
    return columns, processed_data

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
            "label": _(" رصـيد العمـلة"),
            "fieldtype": "Data",
            "width": 150,
        },
        {
            "fieldname": "balance2",
            "label": _("رصــيد المصري"),
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
    conditions = []
    parameters = {}

    # Get filter values
    branch = filters.get("branch")
    # account_currency = filters.get("account_currency")

    # Build conditions based on filters
    if branch:
        conditions.append("`tabAccount`.parent_account = %(branch)s")
        parameters["branch"] = branch
    # if account_currency:
    #     conditions.append("`tabAccount`.account_currency = %(account_currency)s")
    #     parameters["account_currency"] = account_currency

    # Build the WHERE clause
    where_clause = " WHERE " + " AND ".join(conditions) if conditions else ""

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

    result = {
        'data1': [],
        'data2': []
    }

    # Iterate over each record to fetch corresponding GL Entry data
    for record in data:

        if record.is_group == 0:
            # print("RECCCORDDD",record.is_group == 0,record)
            sql1 = """
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
                GROUP BY
                    ge.account, ge.account_currency
            """
            result['data1'] = frappe.db.sql(sql1, {"account_name": record["parent_account"]}, as_dict=True)

        if record.is_group == 1:
            # Collect values for the `IN` clause
            account_names = [record.name for record in data if record.is_group]

            if account_names:
                # Use `IN` clause for multiple values
                placeholders = ', '.join(['%s'] * len(account_names))
                sql2 = f"""
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
                        `tabAccount`.parent_account IN ({placeholders})
                    GROUP BY
                        ge.account, ge.account_currency
                """
                result['data2'] = frappe.db.sql(sql2, tuple(account_names), as_dict=True)

    return result

def process_data(data1, data2, filters):
    if not filters:
        return
    # Ensure data1 and data2 are not None
    data1 = data1 or []
    data2 = data2 or []
    account_currency_filter = filters.get("account_currency")
    result = data1 + data2
    # print("RESult",filters.get("branch"),result)
    # Initialize dictionaries to store totals
    totals = {}
    if filters.get("branch") == '1100 - خزن الفروع - AE':
        print('data1',data1)
        print('data2',data2)
        # print('data2',data2)
        result = data1 + data2
        for entry in result:
            
            currency = entry.get('account_currency', 'Unknown')
            if account_currency_filter and currency != account_currency_filter:
                continue  # Skip entries that don't match the filter

            if currency not in totals:
                totals[currency] = {'total_balance': 0.0, 'total_balance2': 0.0}
            
            # Add to totals
            totals[currency]['total_balance'] += entry.get('balance', 0.0)
            totals[currency]['total_balance2'] += entry.get('balance2', 0.0)
            
        print("entry.get('parent_account')",entry.get('parent_account'))
        # Convert totals to the desired format
        formatted_result = [{ 
            'branch':entry.get('parent_account'),             
            'account_currency': currency, 
            'balance': values['total_balance'], 
            'balance2': values['total_balance2']
        } for currency, values in totals.items()]

        return formatted_result
    else:
        # Calculate totals
        for entry in result:
            
            currency = entry.get('account_currency', 'Unknown')
            if account_currency_filter and currency != account_currency_filter:
                continue  # Skip entries that don't match the filter

            if currency not in totals:
                totals[currency] = {'total_balance': 0.0, 'total_balance2': 0.0}
            
            # Add to totals
            totals[currency]['total_balance'] += entry.get('balance', 0.0)
            totals[currency]['total_balance2'] += entry.get('balance2', 0.0)
            

        # Convert totals to the desired format
        formatted_result = [{ 
            'branch':filters.get("branch"),             
            'account_currency': currency, 
            'balance': values['total_balance'], 
            'balance2': values['total_balance2']
        } for currency, values in totals.items()]

        return formatted_result





