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
    }else{
      frappe.throw("Select a Branch");
      
    }
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