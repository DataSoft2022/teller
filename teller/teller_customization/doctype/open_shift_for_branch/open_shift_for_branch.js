// Copyright (c) 2025, Ahmed Reda  and contributors
// For license information, please see license.txt
frappe.ui.form.on("Open Shift for Branch", {
  setup: function(frm) {
    // Set default shift status on new doc
    if(frm.is_new()) {
      frm.set_value('shift_status', 'Active');
    }
    // Hide current_user and end_date fields initially
    frm.toggle_display('current_user', false);
    frm.toggle_display('end_date', false);
  },

  refresh: function(frm) {
    // Show end_date only if shift is closed
    frm.toggle_display('end_date', frm.doc.shift_status === 'Closed');
  },

  teller_treasury(frm) {
    if (frm.doc.teller_treasury) {
      // Show the current_user field
      frm.toggle_display('current_user', true);
      
      frappe.call({
        method: "teller.teller_customization.doctype.open_shift_for_branch.open_shift_for_branch.get_treasury_employees",
        args: { treasury: frm.doc.teller_treasury },
        callback: function (r) {
          if (r.message && r.message.length > 0) {
            frm.set_query("current_user", function () {
              return {
                filters: {
                  name: ["in", r.message]
                }
              };
            });
          }
        }
      });
    } else {
      // Hide the current_user field if no treasury is selected
      frm.toggle_display('current_user', false);
      frm.set_value('current_user', ''); // Clear the value
      frappe.throw("Select a Teller Treasury");
    }
  },

  create_close_shift: function(frm) {
    frappe.model.open_mapped_doc({
      method: "teller.teller_customization.doctype.open_shift_for_branch.open_shift_for_branch.make_close_shift",
      frm: frm
    });
  }
});

//////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////  indecators status  //////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////
frappe.listview_settings["Open Shift For Branch"]= {
  add_fields: [
    "shift_status", // Ensure entry_type is included in the fields
    // other fields...
  ],
  
  get_indicator: function (doc) {
    console.log("Processing document:", doc);
    if (doc.shift_status === "Active") {
      return [__("Active"), "green", "status,=,Active"];
  
    }else if (doc.status == "Closed") {
      return [__("Closed"), "red", "status,=,Closed"];
    }
  
  }
}