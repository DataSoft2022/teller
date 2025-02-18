// // Copyright (c) 2024, Mohamed AbdElsabour and contributors
// // For license information, please see license.txt



frappe.query_reports["Teller Balance Sheet"] = {
  filters: [
    {
      fieldname: "account",
      label: "Account Name",
      fieldtype: "Link",
      options: "Account",
      width: "200px",
    },
    {
      "fieldname": "account_currency",
      "label": __("Currency"),
      "fieldtype": "MultiSelectList",
      "get_data": function(txt) {
          return frappe.db.get_link_options('Currency', txt);
      }
  },

    {
      fieldname: "from_date",
      label: "From Date",
      fieldtype: "Date",
      width: "200px",
    },
    {
      fieldname: "to_date",
      label: "To Date",
      fieldtype: "Date",
      width: "200px",
    },
  ],
};




