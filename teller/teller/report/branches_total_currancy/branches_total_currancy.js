// Copyright (c) 2024, Mohamed AbdElsabour and contributors
// For license information, please see license.txt

frappe.query_reports["branches total currancy"] = {
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
      fieldname: "account_currency",
      label: __("Currency"),
      width: 150,
      fieldtype: "Select",
      options: erpnext.get_presentation_currency_list(),
      default: "",
      // reqd: 1,
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
  ],
};
