// Copyright (c) 2025, Mohamed AbdElsabour and contributors
// For license information, please see license.txt

frappe.ui.form.on("Treasury Assignment Tool", {
  refresh: function(frm) {
    // Set query for teller_treasury based on selected branch
    frm.set_query("teller_treasury", function() {
      return {
        filters: {
          "branch": frm.doc.branch
        }
      };
    });
  },

  branch: function(frm) {
    // Clear teller_treasury when branch changes
    if(frm.doc.branch) {
      frm.set_value('teller_treasury', '');
    }
  },

  validate: function(frm) {
    if (frm.doc.from_date > frm.doc.to_date) {
      frappe.throw(__("From Date cannot be after To Date"));
    }
  }
});
