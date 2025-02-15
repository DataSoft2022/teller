// // Copyright (c) 2024, Mohamed AbdElsabour and contributors
// // For license information, please see license.txt


frappe.ui.form.on("Companies", {
  // refresh(frm) {
  //   frappe.call({
  //     method: "frappe.client.get_list",
  //     args: {
  //       doctype: "Customer",
  //       filters: {
  //         custom_commercial_no: frm.doc.commercial_no,
  //       },
  //       fields: ["name"],
  //       limit: 1,
  //     },
  //     callback: function (r) {
  //       if (r.message && r.message.length > 0) {
  //         var existing_client = r.message[0];
  //         console.log(existing_client);

  //         frappe.call({
  //           method: "frappe.client.get",
  //           args: {
  //             doctype: "Customer",
  //             name: existing_client.name,
  //           },
  //           callback: function (response) {
  //             if (response.message) {
  //               let latest_company = response.message;
  //               console.log("latest_company", latest_company);

  //               // Update the relevant fields
  //               latest_company.custom_start_registration_date =
  //                 frm.doc.start_registration_date;
  //               latest_company.custom_end_registration_date =
  //                 frm.doc.end_registration_date;
  //               latest_company.custom_comany_address1 =
  //                 frm.doc.company_address || "";
  //               latest_company.custom_commercial_no = frm.doc.commercial_no;
  //               latest_company.custom_legal_form = frm.doc.legal_form;
  //               latest_company.custom_company_no = frm.doc.company_number;
  //               latest_company.custom_company_activity =
  //                 frm.doc.company_activity;

  //               // Save the updated client document
  //               frappe.call({
  //                 method: "frappe.client.save",
  //                 args: {
  //                   doc: latest_company,
  //                 },
  //                 callback: function (save_response) {
  //                   if (save_response.message) {
  //                     frappe.msgprint(
  //                       "Customer Updated Successfully",
  //                       "success"
  //                     );
  //                   } else {
  //                     frappe.throw("Error while updating customer");
  //                   }
  //                 },
  //               });
  //             }
  //           },
  //         });
  //       } else {
  //         console.log("Pleaseerror");
  //       }
  //     },
  //   });
  // },

  after_save(frm) {
    frappe.call({
      method: "frappe.client.get_list",
      args: {
        doctype: "Customer",
        filters: {
          custom_commercial_no: frm.doc.commercial_no,
        },
        fields: ["name"],
        limit: 1,
      },
      callback: function (r) {
        if (r.message && r.message.length > 0) {
          var existing_client = r.message[0];
          console.log(existing_client);

          frappe.call({
            method: "frappe.client.get",
            args: {
              doctype: "Customer",
              name: existing_client.name,
            },
            callback: function (response) {
              if (response.message) {
                let latest_company = response.message;
                console.log("latest_company", latest_company);

                // Update the relevant fields
                latest_company.custom_start_registration_date =
                  frm.doc.start_registration_date;
                latest_company.custom_end_registration_date =
                  frm.doc.end_registration_date;
                latest_company.custom_comany_address1 =
                  frm.doc.company_address || "";
                latest_company.custom_commercial_no = frm.doc.commercial_no;
                latest_company.custom_legal_form = frm.doc.legal_form;
                latest_company.custom_company_no = frm.doc.company_number;
                latest_company.custom_company_activity =
                  frm.doc.company_activity;

                // Save the updated client document
                frappe.call({
                  method: "frappe.client.save",
                  args: {
                    doc: latest_company,
                  },
                  callback: function (save_response) {
                    if (save_response.message) {
                      frappe.msgprint(
                        __("Company Updated Successfully", "success")
                      );
                    } else {
                      frappe.throw("Error while updating customer");
                    }
                  },
                });
              }
            },
          });
        } else {
          frappe.call({
            method: "frappe.client.insert",
            args: {
              doc: {
                doctype: "Customer",
                customer_name: frm.doc.company_name,
                customer_type: "Company",
                custom_commercial_no: frm.doc.commercial_no,
                custom_type: "Company",
                custom_comany_address1: frm.doc.company_address,
                custom_start_registration_date: frm.doc.start_registration_date,
                custom_end_registration_date: frm.doc.end_registration_date,
                custom_company_no: frm.doc.company_number,
                custom_company_activity: frm.doc.company_activity,
                custom_legal_form: frm.doc.legal_form,

                // Add other fields as necessary
              },
            },
            callback: function (insert_response) {
              if (insert_response.message) {
                frappe.msgprint(
                  __(
                    "Customer created successfully in the Customer Doctype",
                    "success"
                  )
                );
              } else {
                frappe.msgprint(
                  "There was an issue creating the customer in the Customer Doctype",
                  "error"
                );
              }
            },
          });
          console.log("Pleaseerror");
        }
      },
    });
  },
});
