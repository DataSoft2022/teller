// Copyright (c) 2025, Ahmed Reda  and contributors
// For license information, please see license.txt
frappe.ui.form.on("Open Shift for Branch", {
  branch(frm) {
    if (frm.doc.branch) {
      frappe.call({
        method:
          "teller.teller_customization.doctype.open_shift_for_branch.open_shift_for_branch.get_user_id",
        args: { branch: frm.doc.branch },
        callback: function (r) {
          if (r.message && r.message.length > 0) {
            let user_ids = r.message.map(user => user.user_id); 
            frm.set_query("current_user", function () {
              return {
                filters: {
                  name: ["in", user_ids]
                }
              };
            });

          }
        }
      });
    }
  }
});

// select e.user_id from `tabEmployee` e where e.branch = '81'