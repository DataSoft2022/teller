// Copyright (c) 2025, Ahmed Reda  and contributors
// For license information, please see license.txt
frappe.ui.form.on("Open Shift for Branch", {
  setup: function(frm) {
    // Set default shift status on new doc
    if(frm.is_new()) {
      frm.set_value('shift_status', 'Active');
    }
    
    // Set query for printing roll to only show active rolls
    frm.set_query("printing_roll", function() {
      return {
        filters: {
          "active": 1
        }
      };
    });
  },

  refresh: function(frm) {
    // Add close shift button for active shifts
    if(frm.doc.docstatus === 1 && frm.doc.shift_status === "Active") {
      frm.page.set_primary_action(__("Close Shift"), function() {
        frappe.model.open_mapped_doc({
          method: "teller.teller_customization.doctype.open_shift_for_branch.open_shift_for_branch.make_close_shift",
          frm: frm
        });
      });
    }
  },

  current_user: function(frm) {
    // When employee is selected, fetch their details
    if(frm.doc.current_user) {
      // First get employee details including user_id
      frappe.db.get_value('Employee', frm.doc.current_user, 
        ['branch', 'employee_name', 'user_id'])
        .then(r => {
          let values = r.message;
          frm.set_value('branch', values.branch);
          frm.set_value('employee_name', values.employee_name);
          
          // Then get teller_treasury from user permissions
          if (values.user_id) {
            return frappe.db.get_list('User Permission', {
              filters: {
                'user': values.user_id,
                'allow': 'Teller Treasury'
              },
              fields: ['for_value']
            });
          }
        })
        .then(r => {
          if (r && r.length > 0) {
            frm.set_value('treasury_permission', r[0].for_value);
          }
        });
    } else {
      // Clear values if no employee selected
      frm.set_value('branch', '');
      frm.set_value('employee_name', '');
      frm.set_value('treasury_permission', '');
    }
  }
});

//////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////  indecators status  //////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////
frappe.listview_settings["Open Shift For Branch"]= {
  add_fields: ["shift_status"],
  
  get_indicator: function (doc) {
    if (doc.shift_status === "Active") {
      return [__("Active"), "green", "shift_status,=,Active"];
    } else if (doc.shift_status === "Closed") {
      return [__("Closed"), "red", "shift_status,=,Closed"];
    }
  }
}