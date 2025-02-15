// Add this line to import the necessary utilities if not already present
// Assuming erpnext.utils is a utility library that might contain a method to add dimensions or other report related utilities.

frappe.query_reports["Profit and Loss Statement2"] = $.extend(
  {},
  erpnext.financial_statements
);

// Add Cost Center as a dimension to the report
erpnext.utils.add_dimensions("Profit and Loss Statement2", 10);

// Existing filters
frappe.query_reports["Profit and Loss Statement2"]["filters"].push({
  fieldname: "selected_view",
  label: __("Select View"),
  fieldtype: "Select",
  options: [
    { value: "Report", label: __("Report View") },
    { value: "Growth", label: __("Growth View") },
    { value: "Margin", label: __("Margin View") },
  ],
  default: "Report",
  reqd: 1,
});

frappe.query_reports["Profit and Loss Statement2"]["filters"].push({
  fieldname: "accumulated_values",
  label: __("Accumulated Values"),
  fieldtype: "Check",
  default: 1,
});

frappe.query_reports["Profit and Loss Statement2"]["filters"].push({
  fieldname: "include_default_book_entries",
  label: __("Include Default FB Entries"),
  fieldtype: "Check",
  default: 1,
});

// Add a new filter for Cost Center
frappe.query_reports["Profit and Loss Statement2"]["filters"].push({
  fieldname: "cost_center",
  label: __("Cost Center"),
  fieldtype: "Link",
  options: "Cost Center",
  get_query: function() {
    return {
      filters: {
        'is_group': 0
      }
    };
  },
  onchange: function() {
    var cost_center = frappe.query_report.get_filter_value('cost_center');
    if (cost_center) {
      // You can add additional logic here if needed when cost center changes
      console.log("Cost Center selected:", cost_center);
    }
  }
});