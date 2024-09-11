// Copyright (c) 2024, Mohamed AbdElsabour and contributors
// For license information, please see license.txt

frappe.query_reports["Currency amount"] = {
  filters: [
    {
      fieldname: "company",
      label: __("Company"),
      fieldtype: "Link",
      options: "Company",
      default: frappe.defaults.get_user_default("Company"),
      reqd: 1,
    },
    {
      fieldname: "name",
      label: __("الفرع"),
      fieldtype: "Link",
      options: "Account",
      onload: function (report) {
        // Set the filter for the "name" field to empty on load
        report.fields_dict["name"].get_query = function () {
          return {
            filters: [
              // Example filter condition: show only accounts where `fieldname` is empty
              ["fieldname", "=", ""],
            ],
          };
        };
      },
    },
    // {
    //   fieldname: "date",
    //   label: __("Date"),
    //   fieldtype: "Date",
    //   default: erpnext.utils.get_fiscal_year(
    //     frappe.datetime.get_today(),
    //     true
    //   )[1],
    //   reqd: 1,
    // },
    // {
    //   fieldname: "account_currency",
    //   label: __("Currency"),
    //   width: 150,
    //   fieldtype: "Select",
    //   default: "",
    //   options: erpnext.get_presentation_currency_list(),
    // },
  ],
};
