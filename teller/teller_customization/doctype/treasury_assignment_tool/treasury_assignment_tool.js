// Copyright (c) 2025, Mohamed AbdElsabour and contributors
// For license information, please see license.txt

frappe.ui.form.on("Treasury Assignment Tool", {
  before_save(frm){
    frappe.call({
      method: "teller.teller_customization.doctype.treasury_assignment_tool.treasury_assignment_tool.assign_to_trasury",
      args: {
          self: frm.doc,
      },
      callback: function (r) {
      console.log(r.message)

      }

  });
  }
});
