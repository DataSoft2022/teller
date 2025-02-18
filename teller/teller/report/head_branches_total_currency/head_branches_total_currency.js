// Copyright (c) 2024, Mohamed AbdElsabour and contributors
// For license information, please see license.txt

frappe.query_reports["Head Branches total currency"] = {
  filters: [
    {
      fieldname: "branch",
      label: __("الفرع"),
      fieldtype: "Link",
      options: "Account",
      get_query: function (report) {
        return {
          filters: [["Account", "custom_is_branch", "=", "1"]],
        };
      },
    },
    // {
    //   fieldname: "branch",
    //   label: __("الفرع"),
    //   fieldtype: "Link",
    //   options: "Account",
    //   //   onload: function (report) {
    //   //     // Set the filter for the "name" field to empty on load
    //   //     report.fields_dict["name"].get_query = function () {
    //   //       return {
    //   //         filters: [
    //   //           // Example filter condition: show only accounts where `fieldname` is empty
    //   //           ["fieldname", "=", ""],
    //   //         ],
    //   //       };
    //   //     };
    //   //   },
    // },
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
