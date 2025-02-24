frappe.ui.form.on("Printing Roll", {
  after_save: function (frm) {
    // last_num_str = frm.doc.last_printed_number.toString().length;
    // frm.set_value("show_number", last_num_str);
    // console.log(last_num_str);
  },
  setup: function(frm) {
    // Set up branch field filtering based on user's branch
    frm.set_query("branch", function() {
      return {
        query: "frappe.client.get_list",
        filters: [["Branch", "name", "!=", ""]] // Default show all branches
      };
    });

    // Get the employee linked to the current user
    frappe.call({
      method: "frappe.client.get_value",
      args: {
        doctype: "Employee",
        filters: { "user_id": frappe.session.user },
        fieldname: ["branch", "name"]
      },
      callback: function(r) {
        if (r.message && r.message.branch) {
          // User has an assigned branch, restrict to only that branch
          frm.set_query("branch", function() {
            return {
              filters: {
                "name": r.message.branch
              }
            };
          });
          // Set the branch value if it's a new form
          if (frm.is_new()) {
            frm.set_value("branch", r.message.branch);
          }
        }
      }
    });
  },
  before_save: function (frm) {
    frm.set_df_property("start_count", "read_only", 1);
    
    if (
      frm.doc.end_count &&
      frm.doc.start_count &&
      frm.doc.end_count < frm.doc.start_count
    ) {
      frappe.throw(__("End Count cannot be less than Start Count"));
    }
  },
});
