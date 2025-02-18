// Copyright (c) 2024, Mohamed AbdElsabour and contributors
// For license information, please see license.txt

frappe.query_reports["Teller Invoice Report"] = {
  filters: [
    {
      fieldname: "name",
      label: "Invoice Name",
      fieldtype: "Link",
      options: "Teller Invoice",
      width: "200px",
    },
    {
      fieldname: "shift",
      label: "Shift Name",
      fieldtype: "Link",
      options: "OPen Shift",
      width: "200px",
    },
  ],
};
