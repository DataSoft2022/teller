// Copyright (c) 2025, Ahmed Reda  and contributors
// For license information, please see license.txt
frappe.ui.form.on("Open Shift for Branch", {
  setup: function(frm) {
    // Set default shift status on new doc
    if(frm.is_new()) {
      frm.set_value('shift_status', 'Active');
    }
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
          
          // Set branch and employee name
          frm.set_value('branch', values.branch);
          frm.set_value('employee_name', values.employee_name);
          
          // Create promises for both printing roll and treasury permission
          let promises = [];
          
          // Get active printing roll for this branch
          if (values.branch) {
            promises.push(
              frappe.db.get_value('Printing Roll',
                {
                  'branch': values.branch,
                  'active': 1
                },
                'name'
              )
            );
          }
          
          // Get teller_treasury from user permissions
          if (values.user_id) {
            promises.push(
              frappe.db.get_value('User Permission',
                {
                  'user': values.user_id,
                  'allow': 'Teller Treasury'
                },
                'for_value'
              )
            );
          }
          
          // Return both promises to be handled in next then
          return Promise.all(promises);
        })
        .then(results => {
          // Handle results - first result is printing roll, second is treasury
          results.forEach(r => {
            if (r.message) {
              // If it has a 'name' field, it's the printing roll
              if (r.message.name) {
                frm.set_value('printing_roll', r.message.name);
              }
              // If it has a 'for_value' field, it's the treasury permission
              if (r.message.for_value) {
                frm.set_value('treasury_permission', r.message.for_value);
              }
            }
          });
        })
        .catch(err => {
          frappe.msgprint(__("Error fetching details: {0}", [err.message]));
        });
    } else {
      // Clear values if no employee selected
      frm.set_value('branch', '');
      frm.set_value('employee_name', '');
      frm.set_value('treasury_permission', '');
      frm.set_value('printing_roll', '');
    }
  },
  
  branch: function(frm) {
    // When branch changes, fetch active printing roll
    if(frm.doc.branch) {
      frappe.db.get_value('Printing Roll',
        {
          'branch': frm.doc.branch,
          'active': 1
        },
        'name'
      ).then(r => {
        if (r.message && r.message.name) {
          frm.set_value('printing_roll', r.message.name);
        } else {
          frappe.msgprint(__("No active printing roll found for branch {0}. Please configure one first.", [frm.doc.branch]));
          frm.set_value('printing_roll', '');
        }
      });
    } else {
      frm.set_value('printing_roll', '');
    }
  }
});