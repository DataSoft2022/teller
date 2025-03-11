frappe.listview_settings["Open Shift for Branch"] = {
  add_fields: ["shift_status"],
  
  get_indicator: function (doc) {
    if (doc.shift_status === "Active") {
      return [__("Active"), "green", "shift_status,=,Active"];
    } else if (doc.shift_status === "Closed") {
      return [__("Closed"), "red", "shift_status,=,Closed"];
    }
  },
  
  // Use the before_render hook which is more reliable
  before_render() {
    // This will run before the list is rendered
    console.log("Before render hook triggered");
  },
  
  refresh: function(listview) {
    // This runs when the list is refreshed
    console.log("List view refreshed");
    
    // Add our custom button using a more direct approach
    if (!listview.page.has_custom_bulk_button) {
      listview.page.add_inner_button(__("Bulk Open Shifts"), function() {
        console.log("Bulk button clicked");
        show_bulk_shift_dialog();
      }, __("Actions"));
      
      // Mark that we've added the button to prevent duplicates
      listview.page.has_custom_bulk_button = true;
    }
  }
};

// Function to show the bulk shift dialog
function show_bulk_shift_dialog() {
  console.log("Showing bulk shift dialog");
  // First, get the current user's branch (assuming they are a branch manager)
  frappe.call({
    method: "frappe.client.get_value",
    args: {
      doctype: "Employee",
      filters: { user_id: frappe.session.user },
      fieldname: ["branch", "name"]
    },
    callback: function(r) {
      console.log("Employee data received:", r.message);
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
                method: "teller.teller_customization.doctype.open_shift_for_branch.open_shift_for_branch.bulk_create_shifts",
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
        method: "teller.teller_customization.doctype.open_shift_for_branch.open_shift_for_branch.get_branch_employees",
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