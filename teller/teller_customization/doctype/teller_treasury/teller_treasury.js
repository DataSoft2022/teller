// Copyright (c) 2025, Mohamed AbdElsabour and contributors
// For license information, please see license.txt

frappe.ui.form.on("Teller Treasury", {
  validate: function(frm) {
    if (!frm.doc.branch && frm.doc.treasury_code) {
        // frm.doc.name = `${frm.doc.branch}-${frm.doc.treasury_code}`;
        frappe.throw("complete all fields")
    }else{
      return
    }
},

});
