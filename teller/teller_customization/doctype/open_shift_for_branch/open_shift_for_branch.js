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
  },
  
  onload: function(listview) {
    // Add Bulk Open Shifts button to the list view
    listview.page.add_action_item(__("Bulk Open Shifts"), function() {
      // Open dialog for bulk shift creation
      show_bulk_shift_dialog();
    });
  }
}

// Function to show the bulk shift dialog
function show_bulk_shift_dialog() {
  // First, get the current user's branch (assuming they are a branch manager)
  frappe.call({
    method: "frappe.client.get_value",
    args: {
      doctype: "Employee",
      filters: { user_id: frappe.session.user },
      fieldname: ["branch", "name"]
    },
    callback: function(r) {
      if (!r.message || !r.message.branch) {
        frappe.msgprint(__("You must be linked to an employee record with a branch to use this feature."));
        return;
      }
      
      const branch = r.message.branch;
      const manager_employee = r.message.name;
      
      // Create and show the dialog
      const d = new frappe.ui.Dialog({
        title: __("Bulk Open Shifts"),
        fields: [
          {
            label: __("Branch"),
            fieldname: "branch",
            fieldtype: "Link",
            options: "Branch",
            default: branch,
            read_only: 1,
            reqd: 1
          },
          {
            label: __("Start Date"),
            fieldname: "start_date",
            fieldtype: "Datetime",
            default: frappe.datetime.now_datetime(),
            reqd: 1
          },
          {
            label: __("Select Employees"),
            fieldname: "employees_section",
            fieldtype: "Section Break"
          },
          {
            label: __("Employees"),
            fieldname: "employees",
            fieldtype: "Table",
            cannot_add_rows: true,
            cannot_delete_rows: true,
            fields: [
              {
                label: __("Select"),
                fieldname: "select",
                fieldtype: "Check",
                in_list_view: 1,
                columns: 1
              },
              {
                label: __("Employee"),
                fieldname: "employee",
                fieldtype: "Link",
                options: "Employee",
                in_list_view: 1,
                columns: 3,
                read_only: 1
              },
              {
                label: __("Employee Name"),
                fieldname: "employee_name",
                fieldtype: "Data",
                in_list_view: 1,
                columns: 3,
                read_only: 1
              },
              {
                label: __("Status"),
                fieldname: "status",
                fieldtype: "Data",
                in_list_view: 1,
                columns: 2,
                read_only: 1
              },
              {
                label: __("Treasury"),
                fieldname: "treasury",
                fieldtype: "Link",
                options: "Teller Treasury",
                in_list_view: 1,
                columns: 3,
                read_only: 1
              }
            ]
          },
          {
            label: __("Actions"),
            fieldname: "actions_section",
            fieldtype: "Section Break"
          },
          {
            label: __("Select All"),
            fieldname: "select_all",
            fieldtype: "Button"
          },
          {
            label: __("Deselect All"),
            fieldname: "deselect_all",
            fieldtype: "Button"
          }
        ],
        primary_action_label: __("Create Shifts"),
        primary_action: function() {
          // Get selected employees
          const selected_employees = [];
          d.fields_dict.employees.df.data.forEach(row => {
            if (row.select) {
              selected_employees.push(row.employee);
            }
          });
          
          if (selected_employees.length === 0) {
            frappe.msgprint(__("Please select at least one employee."));
            return;
          }
          
          // Confirm creation
          frappe.confirm(
            __("Are you sure you want to create shifts for {0} employees?", [selected_employees.length]),
            function() {
              // Yes - proceed with creation
              frappe.call({
                method: "teller_customization.doctype.open_shift_for_branch.open_shift_for_branch.bulk_create_shifts",
                args: {
                  branch: d.get_value("branch"),
                  start_date: d.get_value("start_date"),
                  employees: selected_employees
                },
                freeze: true,
                freeze_message: __("Creating shifts..."),
                callback: function(r) {
                  if (r.message) {
                    const result = r.message;
                    frappe.msgprint({
                      title: __("Shifts Created"),
                      indicator: "green",
                      message: __("{0} shifts created successfully. {1} failed.", [result.success, result.failed])
                    });
                    
                    // Refresh the list view
                    cur_list.refresh();
                    
                    // Close the dialog
                    d.hide();
                  }
                }
              });
            },
            function() {
              // No - do nothing
            }
          );
        }
      });
      
      // Load employees for the branch
      frappe.call({
        method: "teller_customization.doctype.open_shift_for_branch.open_shift_for_branch.get_branch_employees",
        args: {
          branch: branch
        },
        callback: function(r) {
          if (r.message) {
            // Clear existing rows
            d.fields_dict.employees.df.data = [];
            
            // Add employees to the table
            r.message.forEach(emp => {
              d.fields_dict.employees.df.data.push({
                select: 0,
                employee: emp.name,
                employee_name: emp.employee_name,
                status: emp.has_active_shift ? __("Has Active Shift") : __("Available"),
                treasury: emp.treasury
              });
            });
            
            // Refresh the table
            d.fields_dict.employees.grid.refresh();
            
            // Set up select all / deselect all buttons
            d.fields_dict.select_all.input.onclick = function() {
              d.fields_dict.employees.df.data.forEach(row => {
                if (row.status !== __("Has Active Shift")) {
                  row.select = 1;
                }
              });
              d.fields_dict.employees.grid.refresh();
            };
            
            d.fields_dict.deselect_all.input.onclick = function() {
              d.fields_dict.employees.df.data.forEach(row => {
                row.select = 0;
              });
              d.fields_dict.employees.grid.refresh();
            };
          }
        }
      });
      
      d.show();
    }
  });
}