// Copyright (c) 2024, Mohamed AbdElsabour and contributors
// For license information, please see license.txt

frappe.query_reports["Head branch Currency"] = {
  filters: [
    {
      fieldname: "branch",
      label: __("الفرع"),
      fieldtype: "Link",
      options: "Account",
      get_query: function (report) {
        return {
          filters: [["Account", "name", "=", "خزنة طلعت حرب - AE"]],
        };
      },
    },
    {
      fieldname: "account_currency",
      label: __("Currency"),
      width: 150,
      fieldtype: "Select",
      default: "",
      options: erpnext.get_presentation_currency_list(),
    },
  ],
};
