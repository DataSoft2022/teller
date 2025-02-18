// Copyright (c) 2024, Mohamed AbdElsabour and contributors
// For license information, please see license.txt

frappe.ui.form.on("Teller Invoice", {
  client_type(frm) {
    if (frm.doc.client_type === "Interbank") {
      frappe.call({
        method: "frappe.client.get",
        args: {
          doctype: "Customer",
          name: "البنك الاهلي",
        },
        callback: function (response) {
          console.log("response", response.message);
          frm.set_value("company_name", response.message.name);
          frm.set_value(
            "comoany_address",
            response.message.custom_comany_address1
          );
          frm.set_value(
            "start_registration_date",
            response.message.custom_start_registration_date
          );
          frm.set_value(
            "end_registration_date",
            response.message.custom_end_registration_date
          );
          frm.set_value("company_legal_form", response.message.custom_legal_form);
          frm.set_value("company_num", response.message.custom_commercial_no);
          frm.set_value("company_activity", response.message.custom_company_activity);
          
        },
      });
    }
  },

  refresh(frm) {
    // Set focus on client field only for new documents
    if (frm.is_new()) {
      setTimeout(function () {
        const clientField = frm.get_field("client");
        if (clientField && clientField.$input) {
          clientField.$input.focus();
        }
      }, 100);
    }

    // Make invoice info section collapsible and expanded by default
    frm.toggle_display('section_break_ugcr', true);
    frm.set_df_property('section_break_ugcr', 'collapsible', 1);
    frm.set_df_property('section_break_ugcr', 'collapsed', 0);

    // Ensure total field is always visible
    frm.toggle_display('total', true);
    frm.set_df_property('total', 'hidden', 0);
    
    // Make the total field read-only to prevent manual editing
    frm.set_df_property('total', 'read_only', 1);

    // filter clients based on client type
    frm.set_query("client", function (doc) {
      return {
        filters: {
          custom_type: doc.client_type,
        },
      };
    });
    
    // Add buttons for submitted documents
    if (frm.doc.docstatus === 1) {
      // Add ledger button
      frm.add_custom_button(
        __("Ledger"),
        function () {
          frappe.route_options = {
            voucher_no: frm.doc.name,
            from_date: frm.doc.date,
            to_date: moment(frm.doc.modified).format("YYYY-MM-DD"),
            company: frm.doc.company,
            group_by: "",
            show_cancelled_entries: frm.doc.docstatus === 2,
          };
          frappe.set_route("query-report", "General Ledger");
        },
        "fa fa-table"
      );

      // Add return button if document is not already returned
      if (!frm.doc.is_returned) {
        frm.add_custom_button(__('Return'), function() {
          // Show confirmation dialog
          frappe.confirm(
            __(`Are you sure you want to create a return for this invoice?<br><br>
            This will:<br>
            • Reverse all currency amounts and quantities<br>
            • Create reverse GL entries<br>
            • Mark this invoice as returned<br>
            • Total amount of <strong>${format_currency(Math.abs(frm.doc.total), 'EGP')}</strong> will be reversed<br><br>
            This action cannot be undone.`),
            function() {
              // On 'Yes' - proceed with return
              frappe.call({
                method: 'teller.teller_customization.doctype.teller_invoice.teller_invoice.make_sales_return',
                args: {
                  doc: frm.doc
                },
                callback: function(r) {
                  if (r.message) {
                    frappe.show_alert({
                      message: __('Return created successfully'),
                      indicator: 'green'
                    });
                    frm.reload_doc();
                  }
                }
              });
            },
            function() {
              // On 'No' - do nothing
            }
          );
        });
      }
    }

    set_branch_and_shift(frm);
    loginUser = frappe.session.logged_in_user;
    frappe
      .call({
        method: "frappe.client.get",
        args: {
          doctype: "User",
          name: loginUser,
        },
      })
      .then((r) => {
        if (r.message) {
          console.log(r.message.egy_account);
          let user_account = r.message.egy_account;
          if (user_account) {
            frm.set_value("egy", user_account);
          } else {
            frappe.throw("there is no egy account linked to this user");
          }
        } else {
          frappe.throw("Error while getting user");
        }
      });

    // filters commissar based on company name
    frm.set_query("commissar", function (doc) {
      return {
        query:
          "teller.teller_customization.doctype.teller_invoice.teller_invoice.get_contacts_by_link",
        filters: {
          link_doctype: "Customer",
          link_name: doc.client,
        },
      };
    });

    // Make invoice info section always expandable
    frm.toggle_display('invoice_info_section', true);
    frm.set_df_property('invoice_info_section', 'collapsible', 1);

    // Show treasury code for saved or submitted documents
    if (frm.doc.docstatus || !frm.doc.__islocal) {
      frm.toggle_display('treasury_code', true);
    }
  },
  custom_special_price_2(frm) {
    var d = new frappe.ui.Dialog({
      title: "Booked Special Price",
      fields: [
        {
          label: "Special price document",
          fieldname: "name",
          fieldtype: "Link",
          options: "Special price document",
          get_query: function() {
     
            return {
                filters: [
                    ['custom_interbank_type', '=', 'Selling'],
     
                ]
            };
        }
        },
      ],
      size: "small", // small, large, extra-large
      primary_action_label: "Submit",
      primary_action: async function (values) {
        console.log(values.name);
        let doc = await frappe.db.get_doc(
          "Special price document",
          values.name
        );
        console.log(doc.booked_currency);
        let book_table = doc.booked_currency;
        for (let item of book_table) {
          console.log(item.currency);
          let child = frm.add_child("teller_invoice_details");
          child.currency = item.currency;
          child.currency_code = item.custom_currency_code;
          child.rate = item.rate;
          // frm.doc.teller_invoice_details.forEach((row) => {
          //   frappe.model.set_value(cdt, cdn, "currency", item.currency);
          // });
        }
        frm.refresh_field("teller_invoice_details");
        d.hide();
      },
    });
    d.show();
  },
  show_general_ledger: function (frm) {
    if (frm.doc.docstatus > 0) {
      frm.add_custom_button(
        __("Ledger"),
        function () {
          frappe.route_options = {
            voucher_no: frm.doc.name,
            from_date: frm.doc.date,
            to_date: moment(frm.doc.modified).format("YYYY-MM-DD"),
            company: frm.doc.company,
            group_by: "",
            show_cancelled_entries: frm.doc.docstatus === 2,
          };
          frappe.set_route("query-report", "General Ledger");
        },
        "fa fa-table"
      );
    }
    //
  },

  onload(frm) {
    // setTimeout(function () {
    //   frm.get_field["fetch_national_id"].$input.focus();
    // }, 500);
  },
  // onload_post_render: function (frm) {
  //   // Remove the keydown event when the form is closed
  //   frappe.ui.keys.off("alt+f2");
  // },
  // fetch national id or commerical no

  // Get customer information if exists
  client: function (frm) {
    // Set contact query filters
    frm.set_query("contact", function() {
      return {
        query: "frappe.contacts.doctype.contact.contact.contact_query",
        filters: {
          link_doctype: "Customer",
          link_name: frm.doc.client
        }
      };
    });

    if(frm.doc.client && (frm.doc.client_type === "Egyptian" || frm.doc.client_type === "Foreigner")) {
      frappe.db.get_doc('Customer', frm.doc.client)
        .then(customer => {
          // Always set customer name
          frm.set_value('customer_name', customer.customer_name);
          
          // Set other fields only if they have data
          const fieldMappings = {
            'gender': customer.gender,
            'nationality': customer.custom_nationality,
            'mobile_number': customer.custom_mobile,
            'work_for': customer.custom_work_for,
            'phone': customer.custom_phone,
            'place_of_birth': customer.custom_place_of_birth,
            'date_of_birth': customer.custom_date_of_birth,
            'job_title': customer.custom_job_title,
            'address': customer.custom_address,
            'national_id': customer.custom_national_id
          };

          // Only set values for fields that have data
          Object.entries(fieldMappings).forEach(([field, value]) => {
            if (value) {
              frm.set_value(field, value);
            }
          });

          frm.refresh_fields();
        });
    } else if(frm.doc.client && (frm.doc.client_type === "Company" || frm.doc.client_type === "Interbank")) {
      frappe.db.get_doc('Customer', frm.doc.client)
        .then(customer => {
          const companyFields = {
            'company_name': customer.customer_name,
            'company_activity': customer.custom_company_activity,
            'company_commercial_no': customer.custom_commercial_no,
            'start_registration_date': customer.custom_start_registration_date,
            'end_registration_date': customer.custom_end_registration_date,
            'company_num': customer.custom_company_no,
            'comoany_address': customer.custom_comany_address1,
            'is_expired1': customer.custom_is_expired,
            'interbank': customer.custom_interbank,
            'company_legal_form': customer.custom_legal_form
          };

          // Only set values for fields that have data
          Object.entries(companyFields).forEach(([field, value]) => {
            if (value) {
              frm.set_value(field, value);
            }
          });

          frm.refresh_fields();
        });
    }
  },

  // add comissar to invoice

  commissar: function (frm) {
    if (
      frm.doc.client_type == "Company" ||
      (frm.doc.client_type == "Interbank" && frm.doc.client)
    ) {
      if (frm.doc.commissar) {
        var commissarNAme = frm.doc.commissar;
        var companyName = frm.doc.client;
        var fullCommissarName = commissarNAme;

        //test add

        frappe.call({
          method: "frappe.client.get",
          args: {
            doctype: "Contact",
            name: fullCommissarName,
          },
          callback: function (r) {
            // set the fields with r.message.fieldname
            frm.set_value("com_national_id", r.message.custom_national_id);
            frm.set_value("com_gender", r.message.custom_com_gender);
            frm.set_value("com_address", r.message.custom_com_address);
            frm.set_value("com_name", r.message.first_name);

            frm.set_value("com_phone", r.message.custom_com_phone);
            frm.set_value("com_job_title", r.message.custom_job_title);
            frm.set_value("com_mobile_number", r.message.custom_mobile_number);
          },
        });
      } else {
        // clear the fields
        frm.set_value("com_national_id", "");
        frm.set_value("com_gender", "");
        frm.set_value("com_address", "");
        frm.set_value("com_name", "");
        frm.set_value("com_phone", "");
        frm.set_value("com_job_title", "");
        frm.set_value("com_mobile_number", "");
      }
    } else {
      __("Please select Company Name Before add Commissar");
    }
  },

  // add customer if not already existing///////////////////
  // not we change trigger for testing
  before_save: function (frm) {
    /////test customer history

    ////////

    if (frm.doc.client) {
      // update_contact_list(frm);
    }
    if (
      (frm.doc.client_type == "Egyptian" ||
        frm.doc.client_type == "Foreigner") &&
      !frm.doc.client   
    ) {
      frappe.call({
        method: "frappe.client.insert",
        args: {
          doc: {
            doctype: "Customer",
            customer_name: frm.doc.customer_name,
            customer_name: frm.doc.customer_name,
            gender: frm.doc.gender ? frm.doc.gender : "Male",
            custom_card_type: frm.doc.card_type,
            custom_mobile: frm.doc.mobile_number ? frm.doc.mobile_number : "",
            // custom_work_for: frm.doc.work_for,
            custom_address: frm.doc.address,
            // custom_nationality: frm.doc.nationality,
            // custom_issue_date: frm.doc.issue_date,
            // custom_expired: frm.doc.expired,
            // custom_place_of_birth: frm.doc.place_of_birth,
            custom_date_of_birth: frm.doc.date_of_birth
              ? frm.doc.date_of_birth
              : frappe.datetime.get_today(),
            // custom_job_title: frm.doc.job_title,
            custom_type: frm.doc.client_type,
            custom_national_id:
              frm.doc.card_type == "National ID" ? frm.doc.national_id : null,
            custom_passport_number:
              frm.doc.card_type == "Passport" ? frm.doc.passport_number : null,
            custom_military_number:
              frm.doc.card_type == "Military ID"
                ? frm.doc.military_number
                : null,
          },
        },
        callback: function (r) {
          if (r.message) {
            frm.set_value("client", r.message.name);
          } else {
            frappe.throw("Error while creating customer");
          }
        },
      });
    } else if (
      (frm.doc.client_type == "Egyptian" ||
        frm.doc.client_type == "Foreigner") &&
      frm.doc.client
    ) {
      frappe.call({
        method: "frappe.client.get",
        args: {
          doctype: "Customer",
          filters: {
            name: frm.doc.client,
          },
        },
        callback: function (r) {
          if (r.message) {
            console.log(r.message);

            /////////////////////////////////
            var existing_client = r.message;

            // Fetch the latest version of the document
            frappe.call({
              method: "frappe.client.get",
              args: {
                doctype: "Customer",
                name: existing_client.name,
              },
              callback: function (response) {
                if (response.message) {
                  var latest_client = response.message;
                  // Update the relevant fields

                  latest_client.custom_card_type = frm.doc.card_type;
                  latest_client.custom_work_for = frm.doc.work_for;

                  latest_client.custom_nationality = frm.doc.nationality;
                  latest_client.custom_mobile = frm.doc.mobile_number;
                  latest_client.custom_phone = frm.doc.phone;
                  latest_client.custom_place_of_birth = frm.doc.place_of_birth;

                  latest_client.custom_address = frm.doc.address;
                  latest_client.custom_job_title = frm.doc.job_title;
                  latest_client.custom_date_of_birth =
                    frm.doc.date_of_birth || frappe.datetime.get_today();
                  latest_client.custom_national_id =
                    frm.doc.card_type == "National ID"
                      ? frm.doc.national_id
                      : null;
                  latest_client.custom_passport_number =
                    frm.doc.card_type == "Passport"
                      ? frm.doc.passport_number
                      : null;
                  latest_client.custom_military_number =
                    frm.doc.card_type == "Military ID"
                      ? frm.doc.military_number
                      : null;

                  // Save the updated client document
                  frappe.call({
                    method: "frappe.client.save",
                    args: {
                      doc: latest_client,
                    },
                    callback: function (save_response) {
                      if (save_response.message) {
                        frm.set_value("client", save_response.message.name);
                      } else {
                        frappe.throw("Error while updating customer");
                      }
                    },
                  });
                }
              },
            });
          }
        },
      });
    }

    // update company if company is already existing or created it if company not already existing
    else if (
      (frm.doc.client_type == "Company" ||
        frm.doc.client_type == "Interbank") &&
      !frm.doc.client
    ) {
      frappe.call({
        method: "frappe.client.insert",
        args: {
          doc: {
            doctype: "Customer",
            customer_name: frm.doc.company_name,
            custom_start_registration_date: frm.doc.start_registration_date
              ? frm.doc.start_registration_date
              : frappe.datetime.get_today(),

            custom_end_registration_date: frm.doc.end_registration_date
              ? frm.doc.end_registration_date
              : frappe.datetime.get_today(),

            custom_comany_address1: frm.doc.comoany_address
              ? frm.doc.comoany_address
              : "",

            custom_company_no: frm.doc.company_num
              ? frm.doc.comoany_address
              : "",

            custom_type: frm.doc.client_type,
            custom_interbank:
              frm.doc.interbank && frm.doc.client_type == "Interbank"
                ? true
                : false,

            custom_commercial_no: frm.doc.company_commercial_no,
            custom_company_activity: frm.doc.company_activity
              ? frm.doc.company_activity
              : "",
            custom_legal_form: frm.doc.company_legal_form
              ? frm.doc.company_legal_form
              : "",
            custom_is_expired: frm.doc.is_expired1,

            //company_commercial_no
          },
        },
        callback: function (r) {
          if (r.message) {
            frm.set_value("client", r.message.name);
            handleCommissarCreationOrUpdate(frm);
          } else {
            frappe.throw("Error while creating customer");
          }
        },
      });
    } else if (
      (frm.doc.client_type == "Company" ||
        frm.doc.client_type == "Interbank") &&
      frm.doc.client
    ) {
      frappe.call({
        method: "frappe.client.get",
        args: {
          doctype: "Customer",
          filters: {
            name: frm.doc.client,
          },
        },
        callback: function (r) {
          if (r.message) {
            console.log("response from comapny updated", r.message);

            /////////////////////////////////
            var existing_company = r.message;

            // Fetch the latest version of the document
            frappe.call({
              method: "frappe.client.get",
              args: {
                doctype: "Customer",
                name: existing_company.name,
              },
              callback: function (response) {
                if (response.message) {
                  console.log("company name response", response.message);
                  let latest_company = response.message;
                  // Update the relevant fields
                  latest_company.custom_start_registration_date =
                    frm.doc.start_registration_date;
                  latest_company.custom_end_registration_date =
                    frm.doc.end_registration_date;
                  latest_company.custom_comany_address1 =
                    frm.doc.comoany_address || "";
                  latest_company.custom_commercial_no =
                    frm.doc.company_commercial_no;
                  latest_company.custom_legal_form = frm.doc.company_legal_form;
                  latest_company.custom_company_no = frm.doc.company_num;
                  latest_company.custom_company_activity =
                    frm.doc.company_activity;

                  // latest_company.custom_interbank = true
                  //   ? frm.doc.interbank && frm.doc.client_type == "Interbank"
                  //   : false;

                  // Save the updated client document
                  frappe.call({
                    method: "frappe.client.save",
                    args: {
                      doc: latest_company,
                    },
                    callback: function (save_response) {
                      if (save_response.message) {
                        frm.set_value("client", save_response.message.name);
                        handleCommissarCreationOrUpdate(frm);
                      } else {
                        frappe.throw("Error while updating customer");
                      }
                    },
                  });
                }
              },
            });
          }
        },
      });
    }

    //  add commissar to coompant from invoice

    // if (
    //   (frm.doc.client_type == "Company" ||
    //     frm.doc.client_type == "Interbank") &&
    //   frm.doc.client &&
    //   !frm.doc.commissar
    // ) {
    //   if (!frm.doc.client) {
    //     frappe.msgprint(__("Please select Company first."));
    //     return;
    //   }

    //   // Create a new contact document
    //   var newContact = frappe.model.get_new_doc("Contact");
    //   // var newContact = frappe.new_doc("Contact");
    //   newContact.links = [
    //     {
    //       link_doctype: "Customer",
    //       link_name: frm.doc.client,
    //     },
    //   ];

    //   // Set the necessary fields
    //   newContact.first_name = frm.doc.com_name;
    //   newContact.custom_com_gender = frm.doc.com_gender;

    //   newContact.custom_com_address = frm.doc.com_address;
    //   newContact.custom_com_phone = frm.doc.com_phone;
    //   newContact.custom_national_id = frm.doc.com_national_id;
    //   newContact.custom_job_title = frm.doc.com_job_title;
    //   newContact.custom_mobile_number = frm.doc.com_mobile_number;

    //   // Insert the new contact
    //   frappe.call({
    //     method: "frappe.client.insert",
    //     args: {
    //       doc: newContact,
    //     },
    //     callback: function (r) {
    //       if (r.message) {
    //         frappe.show_alert({
    //           message: __("Commissar added successfully"),
    //           indicator: "green",
    //         });
    //         frm.set_value("commissar", r.message.name);
    //       }
    //     },
    //   });
    // }

    // // update contact if existing
    // else if (
    //   (frm.doc.client_type === "Company" ||
    //     frm.doc.client_type === "Interbank") &&
    //   frm.doc.client &&
    //   frm.doc.commissar
    // ) {
    //   frappe.call({
    //     method: "frappe.client.get",
    //     args: {
    //       doctype: "Contact",
    //       name: frm.doc.commissar,
    //     },
    //     callback: function (r) {
    //       if (r.message) {
    //         let existing_contact = r.message;

    //         // Update the relevant fields
    //         existing_contact.first_name = frm.doc.com_name;
    //         existing_contact.custom_com_gender = frm.doc.com_gender;
    //         existing_contact.custom_national_id = frm.doc.com_national_id;
    //         existing_contact.custom_com_address = frm.doc.com_address || "";
    //         existing_contact.custom_com_phone = frm.doc.com_phone;
    //         existing_contact.custom_job_title = frm.doc.com_job_title;
    //         existing_contact.custom_mobile_number = frm.doc.com_mobile_number;

    //         // Save the updated contact document
    //         frappe.call({
    //           method: "frappe.client.save",
    //           args: {
    //             doc: existing_contact,
    //           },
    //           callback: function (save_response) {
    //             if (save_response.message) {
    //               frappe.show_alert({
    //                 message: __("Commissar updated successfully"),
    //                 indicator: "green",
    //               });
    //               frm.set_value("commissar", save_response.message.name);
    //             } else {
    //               frappe.throw(__("Error while updating Commissar"));
    //             }
    //           },
    //           error: function () {
    //             frappe.throw(__("Error while updating Commissar"));
    //           },
    //         });
    //       } else {
    //         frappe.throw(__("Commissar not found"));
    //       }
    //     },
    //     error: function () {
    //       frappe.throw(__("Error while fetching Commissar details"));
    //     },
    //   });
    // }
  },

  /////////////////////////////////////////////

  // set special price
  // special_price: function (frm) {
  //   if (frm.doc.docstatus == 0) {
  //     let total_currency_amount = 0;

  //     frm.doc.teller_invoice_details.forEach((row) => {
  //       if (row.paid_from) {
  //         frappe.call({
  //           method:
  //             "teller.teller_customization.doctype.teller_invoice.teller_invoice.get_currency",
  //           args: {
  //             account: row.paid_from,
  //           },
  //           callback: function (r) {
  //             console.log(r.message[2]);
  //             selling_special_rate = r.message[2];
  //             row.rate = selling_special_rate;
  //             console.log(r.message[2]);
  //             let currency_total = row.rate * row.usd_amount;
  //             row.total_amount = currency_total;

  //             console.log(
  //               `the total of ${row.currency} is ${row.total_amount}`
  //             );

  //             total_currency_amount += currency_total;
  //             console.log("from loop: " + total_currency_amount);
  //             frm.refresh_field("teller_invoice_details");
  //             frm.set_value("total", total_currency_amount);
  //           },
  //         });
  //       }
  //     });
  //     console.log("from outer loop: " + total_currency_amount);
  //   }
  // },

  egy: (frm) => {
    if (frm.doc.egy) {
      frappe.call({
        method:
          "teller.teller_customization.doctype.teller_invoice.teller_invoice.account_to_balance",
        args: {
          paid_to: frm.doc.egy,
          // company: frm.doc.company,
        },
        callback: function (r) {
          if (r.message) {
            console.log(r.message);
            let egy_balance = r.message;

            frm.set_value("egy_balance", egy_balance);
          } else {
            console.log("not found");
          }
        },
      });
    }
  },
  total: function (frm) {
    if (frm.doc.client && frm.doc.total) {
      // check if the total is exceeded
      isExceededLimit(frm, frm.doc.client, frm.doc.total);
    } else {
      // teller_invoice_details
      frappe.msgprint({
        message:
          '<div style="background-color: #f8d7da; color: #721c24; padding: 10px; border-radius: 5px; font-family: Arial, sans-serif; font-size: 14px;">Pleases enter Customer to validate the transaction</div>',
        title: "Missing Data Error",
        indicator: "red",
      });
    }
  },
  //validate if national id is valid

  validate: function (frm) {
    // validate individual client national id
    if (
      (frm.doc.client_type == "Egyptian" ||
        frm.doc.client_type == "Foreigner") &&
      frm.doc.national_id
    ) {
      validateNationalId(frm, frm.doc.national_id);
    }

    // validate commissar national id

    if (
      (frm.doc.client_type == "Company" ||
        frm.doc.client_type == "Interbank") &&
      frm.doc.commissar &&
      frm.doc.com_national_id
    ) {
      validateNationalId(frm, frm.doc.com_national_id);
    }

    if (
      (frm.doc.client_type == "Company" ||
        frm.doc.client_type == "Interbank") &&
      frm.doc.client
    ) {
      validateRegistrationDate(
        frm,
        frm.doc.start_registration_date,
        frm.doc.end_registration_date
      );
      validateRegistrationDateExpiration(frm, frm.doc.end_registration_date);
    }
  },

  contact: function(frm) {
    if (frm.doc.contact) {
      frappe.call({
        method: "frappe.client.get",
        args: {
          doctype: "Contact",
          name: frm.doc.contact
        },
        callback: function(r) {
          if (r.message) {
            // Set contact related fields if needed
            frm.refresh_field("contact");
          }
        }
      });
    }
  },

  client_type: function(frm) {
    // Clear all individual fields
    if(frm.doc.client_type !== "Egyptian" && frm.doc.client_type !== "Foreigner") {
      const individualFields = [
        'customer_name', 'national_id', 'gender', 'nationality',
        'mobile_number', 'work_for', 'phone', 'place_of_birth',
        'date_of_birth', 'job_title', 'address'
      ];
      individualFields.forEach(field => frm.set_value(field, ''));
    }
    
    // Clear all company fields
    if(frm.doc.client_type !== "Company" && frm.doc.client_type !== "Interbank") {
      const companyFields = [
        'company_name', 'company_activity', 'company_commercial_no',
        'company_num', 'end_registration_date', 'start_registration_date',
        'comoany_address', 'is_expired1', 'interbank', 'company_legal_form'
      ];
      companyFields.forEach(field => frm.set_value(field, ''));
    }
    
    frm.refresh_fields();
  },

  search_client: function(frm) {
    if (!frm.doc.client_search_id) {
      frappe.msgprint(__('Please enter an ID/Number to search'));
      return;
    }
    
    frappe.call({
      method: 'teller.teller_customization.doctype.teller_invoice.teller_invoice.search_client_by_id',
      args: {
        search_id: frm.doc.client_search_id
      },
      callback: function(r) {
        if (r.message) {
          // First set the client type to trigger any dependent field updates
          frm.set_value('client_type', r.message.custom_type);
          // Then set the client
          frm.set_value('client', r.message.name);
          frm.set_value('client_search_id', ''); // Clear the search field
        } else {
          frappe.msgprint(__('No customer found with the given ID/Number'));
        }
      }
    });
  },

  setup: function(frm) {
    // Get user's egy_account and set it only for new documents
    if (frm.is_new()) {
      frappe.call({
        method: "frappe.client.get_value",
        args: {
          doctype: "User",
          filters: { name: frappe.session.user },
          fieldname: "egy_account"
        },
        callback: function(r) {
          if (r.message && r.message.egy_account) {
            frm.set_value('egy', r.message.egy_account);
            // After setting egy account, fetch its balance
            frappe.call({
              method: "teller.teller_customization.doctype.teller_invoice.teller_invoice.account_to_balance",
              args: {
                paid_to: r.message.egy_account
              },
              callback: function(r) {
                if (r.message) {
                  frm.set_value('egy_balance', r.message);
                  frm.refresh_field('egy_balance');
                }
              }
            });
          }
        }
      });
    }

    // Filter accounts in child table to only show accounts linked to user's treasury
    frm.fields_dict["teller_invoice_details"].grid.get_field("account").get_query = function(doc) {
      return {
        query: "teller.teller_customization.doctype.teller_invoice.teller_invoice.get_treasury_accounts",
        filters: {
          treasury_code: doc.treasury_code
        }
      };
    };

    // Set query for currency_code field in child table
    frm.fields_dict["teller_invoice_details"].grid.get_field("currency_code").get_query = function(doc) {
      return {
        query: "teller.teller_customization.doctype.teller_invoice.teller_invoice.get_treasury_currencies",
        filters: {
          treasury_code: doc.treasury_code
        }
      };
    };

    // Make treasury_code and shift read-only after submission
    if (frm.doc.docstatus === 1) {
      frm.set_df_property('treasury_code', 'read_only', 1);
      frm.set_df_property('shift', 'read_only', 1);
    }

    // Rest of your existing setup code...
  },
});

//  teller_invoice_details currency table
frappe.ui.form.on("Teller Invoice Details", {
  // filter accounts

  code: function (frm, cdt, cdn) {
    setTimeout(function () {
      var acc_currency;
      var row = locals[cdt][cdn];
      if (row.paid_from) {
         frappe.call({
          method:
            "teller.teller_customization.doctype.teller_invoice.teller_invoice.get_currency",
          args: {
            account: row.paid_from,
          },
          callback:  function (r) {
            console.log("Currency tablexx: ",r.message);
            // let currencyCode = r.message["currency_code"];
            // let currency = r.message["currency"];
            let currency_rate = r.message["selling_rate"];
            console.log("xxxxxxx",currency_rate)
            // let special_selling_rate = r.message["special_selling_rate"];
            // console.log("currencyCode : ",currencyCode);
            // console.log("currency : ",currency);
            // console.log("currency_rate : ",currency_rate);
            // console.log("special_selling_rate : ",special_selling_rate);
            // console.log("the currency code is " + currencyCode);
  
            // frappe.model.set_value(cdt, cdn, "currency", curr);
            frappe.model.set_value(cdt, cdn, "rate", currency_rate);
            // frappe.model.set_value(cdt, cdn , "code", currencyCode);
          },
        });
  
        frappe.call({
          method:
            "teller.teller_customization.doctype.teller_invoice.teller_invoice.account_from_balance",
          args: {
            paid_from: row.paid_from,
          },
          callback: function (r) {
            if (r.message) {
              console.log("the teller balance is", r.message);
              let from_balance = r.message;
              let formatted_balance = format_currency(from_balance, acc_currency);
              console.log(typeof formatted_balance);
  
              frappe.model.set_value(cdt, cdn, "balance", formatted_balance);
            } else {
              console.log("not found");
            }
          },
        });
      }
    },1000)

  },

  usd_amount: async function (frm, cdt, cdn) {
    var row = locals[cdt][cdn];

    if (row.paid_from && row.usd_amount) {
      let total = row.usd_amount * row.rate;

      frappe.model.set_value(cdt, cdn, "total_amount", total);
      // set received amount
      frappe.model.set_value(cdt, cdn, "received_amount", total);

      // let currency = row.currency; // Fetch the stored currency
      // let formatted_usd_amount = format_currency(row.usd_amount, currency);
      // frappe.model.set_value(cdt, cdn, "usd_amount", formatted_usd_amount);
    }
    // else {
    //   frappe.throw("You must enter all required fields.");
    // }
  },

  total_amount: function (frm, cdt, cdn) {
    let row = locals[cdt][cdn];
    let total = 0;
    let currency_total = 0;
    if (row.total_amount) {
      frm.doc.teller_invoice_details.forEach((item) => {
        total += item.total_amount;
      });
      frm.set_value("total", total);
    }
  },
  teller_invoice_details_remove: function (frm) {
    let total = 0;
    frm.doc.teller_invoice_details.forEach((item) => {
      total += item.total_amount;
    });
    frm.set_value("total", total);
  },
  // currency_code(frm, cdt, cdn) {
  //   let row = locals[cdt][cdn];
  //   let sessionUser = frappe.session.logged_in_user;
  //   console.log("User....",sessionUser)
  //   console.log("field is triger");
  //   frappe.call({
  //     method:
  //       "teller.teller_customization.doctype.teller_invoice.teller_invoice.get_current_user_currency_codes",
  //     args: {
  //       current_user: sessionUser,
  //       code: row.currency_code,
  //     },
  //     callback: function (r) {
  //       if (!r.exc) {
  //         // console.log(r.message[0]["account"]);
  //         let userAccount = r.message[0].account;
  //         console.log("the user account is", userAccount);
  //         frappe.model.set_value(cdt, cdn, "paid_from", userAccount);
  //       }
  //     },
  //   });
  // },
});
function set_branch_and_shift(frm) {
  // Only fetch and set treasury details for new documents
  if (frm.is_new()) {
    frappe.call({
      method: "teller.teller_customization.doctype.teller_invoice.teller_invoice.get_employee_shift_details",
      callback: function(r) {
        if (r.message) {
          let shift_details = r.message;
          
          // Set shift and teller info
          frm.set_value("shift", shift_details.shift);
          frm.set_value("teller", shift_details.teller);
          frm.set_value("treasury_code", shift_details.treasury_code);
          frm.set_value("branch_name", shift_details.branch_name);
          frm.set_value("branch_no", shift_details.branch);
          
          // Show the treasury code field since we have shift details
          frm.toggle_display('treasury_code', true);
          
          // Refresh the fields
          frm.refresh_fields([
            "shift",
            "teller",
            "treasury_code",
            "branch_name",
            "branch_no"
          ]);
        } else {
          frappe.msgprint({
            title: __('Warning'),
            indicator: 'red',
            message: __('No active shift found for current user. Please open a shift first.')
          });
          
          // Hide treasury code if no shift details
          frm.toggle_display('treasury_code', false);
          
          // Optionally disable form
          frm.disable_save();
        }
      }
    });
  }
}

//  add contact list to company
// function update_contact_list(frm) {
//     if (frm.doc.client) {
//         frappe.call({
//             method: "frappe.client.get_list",
//             args: {
//                 doctype: "Contact",
//                 filters: {
//                     "link_doctype": "Customer",
//                     "link_name": frm.doc.client
//                 },
//                 fields: ["name", "first_name", "last_name"]
//             },
//             callback: function(r) {
//                 if (r.message && r.message.length) {
//                     frm.set_value("contact", r.message[0].name);
//                 } else {
//                     frm.set_value("contact", "");
//                 }
//             }
//         });
//     } else {
//         frm.set_value("contact", "");
//     }
// }

//  check if the if the current invioce or customer total invoices  exceeds the limit

async function isExceededLimit(frm, clientName, invoiceTotal) {
  let allowedAmount = await fetchAllowedAmount();
  console.log("the allowed amount is", allowedAmount);

  let customerTotal = await getCustomerTotalAmount(clientName);
  console.log("the customer total is", customerTotal);

  let limiDuration = await fetchLimitDuration();
  console.log("the limit duration", limiDuration);

  if (allowedAmount && limiDuration && customerTotal) {
    if (invoiceTotal > allowedAmount && customerTotal > allowedAmount) {
      let message = `
            <div style="background-color: #f8d7da; color: #721c24; padding: 10px; border-radius: 5px; font-family: Arial, sans-serif; font-size: 14px;">
              The Total Amount of the Current Invoice  And  Customer Total  ${customerTotal} Withen ${limiDuration} Days EGP are Exceed Limit  ${allowedAmount} EGP 
            </div>`;

      frappe.msgprint({
        message: message,
        title: "Limitations Exceeded",
        indicator: "red",
      });
      frm.set_value("exceed", true);
    } else if (invoiceTotal > allowedAmount) {
      let message = `
        <div style="background-color: #f8d7da; color: #721c24; padding: 10px; border-radius: 5px; font-family: Arial, sans-serif; font-size: 14px;">
          The Total Amount of the Current Invoice  is Exceed Limit ${allowedAmount} EGP 
        </div>`;

      frappe.msgprint({
        message: message,
        title: "Limitations Exceeded",
        indicator: "red",
      });
      frm.set_value("exceed", true);
    } else if (customerTotal > allowedAmount) {
      let message = `
        <div style="background-color: #f8d7da; color: #721c24; padding: 10px; border-radius: 5px; font-family: Arial, sans-serif; font-size: 14px;">
           Customer Total   ${customerTotal} EGP Withen ${limiDuration} Days  are Exceed Limit ${allowedAmount} EGP 
        </div>`;

      frappe.msgprint({
        message: message,
        title: "Limitations Exceeded",
        indicator: "red",
      });
      frm.set_value("exceed", true);
    } else {
      frm.set_value("exceed", false);
    }
  } else {
    frappe.throw(
      "Please provide in settings allowing for limit  and the duration"
    );
  }
}

// get the allowed amount from Teller settings
async function fetchAllowedAmount() {
  return frappe.db.get_single_value("Teller Setting", "allowed_amount");
}
// get the customer Total Invoices Amount
async function getCustomerTotalAmount(clientName) {
  let limiDuration = await fetchLimitDuration();

  return new Promise((resolve, reject) => {
    frappe.call({
      method:
        "teller.teller_customization.doctype.teller_invoice.teller_invoice.get_customer_total_amount",
      args: {
        client_name: clientName,
        duration: limiDuration,
      },
      callback: function (r) {
        if (r.message) {
          resolve(r.message);
        } else {
          reject("No response message");
        }
      },
    });
  });
}

// fetch the duration of the limit
async function fetchLimitDuration() {
  return frappe.db.get_single_value("Teller Setting", "duration");
}

// create or update commissar for company

function handleCommissarCreationOrUpdate(frm) {
  if (
    (frm.doc.client_type == "Company" || frm.doc.client_type == "Interbank") &&
    frm.doc.client &&
    !frm.doc.commissar
  ) {
    if (!frm.doc.client) {
      frappe.msgprint(__("Please select Company first."));
      return;
    }

    var newContact = frappe.model.get_new_doc("Contact");
    newContact.links = [
      {
        link_doctype: "Customer",
        link_name: frm.doc.client,
      },
    ];

    // Set the necessary fields
    newContact.first_name = frm.doc.com_name;
    newContact.custom_com_gender = frm.doc.com_gender;

    newContact.custom_com_address = frm.doc.com_address;
    newContact.custom_com_phone = frm.doc.com_phone;
    newContact.custom_national_id = frm.doc.com_national_id;
    newContact.custom_job_title = frm.doc.com_job_title;
    newContact.custom_mobile_number = frm.doc.com_mobile_number;

    frappe.call({
      method: "frappe.client.insert",
      args: {
        doc: newContact,
      },
      callback: function (r) {
        if (r.message) {
          frappe.show_alert({
            message: __("Commissar added successfully"),
            indicator: "green",
          });
          frm.set_value("commissar", r.message.name);
        }
      },
    });
  } else if (
    (frm.doc.client_type === "Company" ||
      frm.doc.client_type === "Interbank") &&
    frm.doc.client &&
    frm.doc.commissar
  ) {
    frappe.call({
      method: "frappe.client.get",
      args: {
        doctype: "Contact",
        name: frm.doc.commissar,
      },
      callback: function (r) {
        if (r.message) {
          let existing_contact = r.message;

          // Update the relevant fields
          existing_contact.first_name = frm.doc.com_name;
          existing_contact.custom_com_gender = frm.doc.com_gender;
          existing_contact.custom_national_id = frm.doc.com_national_id;
          existing_contact.custom_com_address = frm.doc.com_address || "";
          existing_contact.custom_com_phone = frm.doc.com_phone;
          existing_contact.custom_job_title = frm.doc.com_job_title;
          existing_contact.custom_mobile_number = frm.doc.com_mobile_number;

          frappe.call({
            method: "frappe.client.save",
            args: {
              doc: existing_contact,
            },
            callback: function (save_response) {
              if (save_response.message) {
                frappe.show_alert({
                  message: __("Commissar updated successfully"),
                  indicator: "green",
                });
                frm.set_value("commissar", save_response.message.name);
              } else {
                frappe.throw(__("Error while updating Commissar"));
              }
            },
            error: function () {
              frappe.throw(__("Error while updating Commissar"));
            },
          });
        }
      },
      error: function () {
        frappe.throw(__("Error while fetching Commissar details"));
      },
    });
  }
}

// validate the national id

function validateNationalId(frm, nationalId) {
  // if (!/^\d{14}$/.test(nationalId)) {
  //   frappe.msgprint(
  //     __("National ID must be exactly 14 digits and contain only numbers.")
  //   );
  //   frappe.validated = false;
  // }
  return /^[0-9]{14}$/.test(nationalId);
}

function validateRegistrationDate(frm, start, end) {
  if (start && end && start > end) {
    frappe.msgprint(__("Registration Date cannot be after Expiration Date."));
    frappe.validated = false;
  }
}

function validateRegistrationDateExpiration(frm, end) {
  if (end) {
    // Get today's date using Frappe's date utility
    const today = frappe.datetime.get_today();

    // Convert dates to Date objects for comparison
    const endDate = new Date(end);
    const todayDate = new Date(today);

    // Compare the dates
    if (endDate < todayDate) {
      frm.set_value("is_expired1", true);
    }
  }
}
//////////////////////////////////////Ahmed Reda //////////////////////////////////////////
//////////////////////////////////////Ahmed Reda //////////////////////////////////////////
//////////////////////////////////////Ahmed Reda //////////////////////////////////////////

////////////////////////////test====/////////////////////////////////////////////////////////
frappe.ui.form.on('Teller Invoice', {
  special_price: function(frm) {
    if (!frm.doc.client_type || frm.doc.client_type !== 'Interbank') {
      frappe.throw({
        title: __("Mandatory"),
        message: __("Please Select a Client Type Interbank")
      });
    } else {
      frm.clear_table("teller_invoice_details");
    }

    if (!frm.doc.client ) {
      frappe.throw({
        title: __("Mandatory"),
        message: __("Please Select a Search Client")
      });
    }
    let query_args = {  
      filters: {
        "docstatus": ["!=", 2],
        "customer": frm.doc.company_name,
        "status": ["in", ["Partial Billed", "Not Billed"]]
      }
    };

    new frappe.ui.form.MultiSelectDialog({
      doctype: "Booking Interbank",
      target: frm,
      setters: {
        transaction: 'Selling',
        branch: null,
        customer: 'البنك الاهلي',
      },
      add_filters_group: 1,
      date_field: "date",
      child_columns: ["currency", "qty", "rate", "status"],
      child_fieldname: "booked_currency",
      columns: ["name", "transaction", "status", "date"],
      get_query() {
        return query_args;
      },
      action(selections, args) {
        selections.forEach(function(booking_ib) {
          if (booking_ib) {
            frappe.call({
              method: "frappe.client.get",
              args: {
                doctype: "Booking Interbank",
                filters: {
                  "name": booking_ib,
                  "status": ["in", ["Partial Billed", "Not Billed"]]
                }
              },
              callback: function(response) {
                if (response && response.message) {
                  response.message.booked_currency.forEach(function(item) {
                    var bo_items = args.filtered_children;
                    if (item.status === "Not Billed") {
                      if (bo_items.length) {
                        // frappe.msgprint("Table Booked Currency => Selected");
                        bo_items.forEach(function(bo_item) {
                          if (bo_item == item.name) {
                            var child = frm.add_child("teller_invoice_details");
                            child.code = item.currency_code;
                            child.currency_code = item.currency;
                            child.usd_amount = item.qty;
                            child.rate = item.rate;
                            child.total_amount = item.qty * item.rate;
                            child.booking_interbank = booking_ib;
                            get_account(frm, child);
                  



                          }
                        });
                      } else {
                        // frappe.msgprint("Booking Interbank => Selected");
                        var child = frm.add_child("teller_invoice_details");
                        child.code = item.currency_code;
                        get_account(frm, child);
                        child.booking_interbank = booking_ib;
                        child.currency_code = item.currency;
                        child.total_amount = item.qty * item.rate;
                        child.usd_amount = item.qty;
                        child.rate = item.rate;
                      }
                    }
                  });
                  frm.refresh_field("teller_invoice_details");
                  cur_dialog.hide();
                  let total = 0;
    
                  frm.doc.teller_invoice_details.forEach((item) => {
              //       // frm.db.set_valu
                    total += item.total_amount;
                  });
                  frm.set_value("total", total);
                  frm.refresh_field("total");

                    console.log("before save total is :",total)


                }
              }
            });
          }
        });
      }
    });
  }
});

  //////////////////////////////////////////////////////////////////////////////////////////
                              //  Filter paid_from //
  //////////////////////////////////////////////////////////////////////////////////////////
  frappe.ui.form.on("Teller Invoice Details", {
    // filter accounts
  
    code: function (frm, cdt, cdn) {
      var row = locals[cdt][cdn];
      console.log(row)
      var code = row.code;
      var curr = row.currency;

          frm.fields_dict["teller_invoice_details"].grid.get_field("paid_from").get_query =
      function () {


        return {
          filters: {
          
            account_currency: ["!=", "EGP"],
            is_group: 0,
            custom_currency_number: row.code,
          },
        };
      };
    },
    paid_from: function (frm, cdt, cdn) {
      var row = locals[cdt][cdn];
      console.log(row)
      var code = row.code;
      var curr = row.currency;

          frm.fields_dict["teller_invoice_details"].grid.get_field("paid_from").get_query =
      function () {


        return {
          filters: {
          
            account_currency: ["!=", "EGP"],
            is_group: 0,
            custom_currency_number: row.code,
          },
        };
      };
    },
    
  })

  //////////////////////////////////////////////////////////////////////////////////

  frappe.ui.form.on("Teller Invoice Details", {
    currency_code: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        console.log("Currency code changed:", row.currency_code);
        
        if (row.currency_code && frm.doc.treasury_code) {
            // Get account and currency based on currency code and treasury
            frappe.call({
                method: 'teller.teller_customization.doctype.teller_invoice.teller_invoice.get_treasury_accounts',
                args: {
                    filters: JSON.stringify({
                        custom_currency_code: row.currency_code,
                        treasury_code: frm.doc.treasury_code
                    })
                },
                callback: function(response) {
                    console.log("Account response:", response);
                    if (response.message && response.message.length > 0) {
                        let account = response.message[0];  // Get first account
                        
                        // Set the account and currency
                        frappe.model.set_value(cdt, cdn, 'account', account[0]);  // First element is account name
                        frappe.model.set_value(cdt, cdn, 'currency', account[1]); // Second element is currency
                        
                        // Get exchange rate
                        frappe.call({
                            method: 'frappe.client.get_list',
                            args: {
                                doctype: 'Currency Exchange',
                                filters: {
                                    'from_currency': account[1],
                                    'to_currency': 'EGP'
                                },
                                fields: ['custom_selling_exchange_rate', 'exchange_rate'],
                                order_by: 'date desc, creation desc',
                                limit: 1
                            },
                            callback: function(rate_response) {
                                console.log("Rate response:", rate_response);
                                if (rate_response.message && rate_response.message.length > 0) {
                                    let rate = rate_response.message[0];
                                    // Use selling exchange rate if available, otherwise use regular exchange rate
                                    let exchange_rate = rate.custom_selling_exchange_rate || rate.exchange_rate;
                                    if (exchange_rate) {
                                        frappe.model.set_value(cdt, cdn, 'exchange_rate', exchange_rate);
                                    }
                                }
                            }
                        });
                    } else {
                        frappe.msgprint(__('No accounts found for the selected currency code in your treasury.'));
                        frappe.model.set_value(cdt, cdn, 'account', '');
                        frappe.model.set_value(cdt, cdn, 'currency', '');
                        frappe.model.set_value(cdt, cdn, 'exchange_rate', '');
                    }
                }
            });
        } else if (!frm.doc.treasury_code) {
            frappe.msgprint(__('Please ensure treasury code is set before selecting currency.'));
            frappe.model.set_value(cdt, cdn, 'currency_code', '');
        }
    },

    account: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row.account) {
            // Get currency and currency code from account
            frappe.call({
                method: 'frappe.client.get',
                args: {
                    doctype: 'Account',
                    name: row.account
                },
                callback: function(response) {
                    if (response.message) {
                        let account = response.message;
                        
                        // Set currency code and currency
                        frappe.model.set_value(cdt, cdn, 'currency_code', account.custom_currency_code);
                        frappe.model.set_value(cdt, cdn, 'currency', account.account_currency);
                        
                        // Get exchange rate
                        frappe.call({
                            method: 'frappe.client.get_list',
                            args: {
                                doctype: 'Currency Exchange',
                                filters: {
                                    'from_currency': account.account_currency
                                },
                                fields: ['custom_selling_exchange_rate'],
                                order_by: 'creation desc',
                                limit: 1
                            },
                            callback: function(rate_response) {
                                if (rate_response.message && rate_response.message.length > 0) {
                                    frappe.model.set_value(cdt, cdn, 'exchange_rate', 
                                        rate_response.message[0].custom_selling_exchange_rate);
                                }
                            }
                        });
                    }
                }
            });
        }
    },

    quantity: function(frm, cdt, cdn) {
        calculate_amounts(frm, cdt, cdn);
    },

    exchange_rate: function(frm, cdt, cdn) {
        calculate_amounts(frm, cdt, cdn);
    }
});

function calculate_amounts(frm, cdt, cdn) {
    let row = locals[cdt][cdn];
    if (row.quantity && row.exchange_rate) {
        // Calculate amount in original currency
        let amount = flt(row.quantity);
        frappe.model.set_value(cdt, cdn, 'amount', amount);
        
        // Calculate amount in EGY
        let egy_amount = flt(amount * row.exchange_rate);
        frappe.model.set_value(cdt, cdn, 'egy_amount', egy_amount);
        
        // Update total by summing all egy_amounts
        let total = 0;
        frm.doc.teller_invoice_details.forEach((item) => {
            total += flt(item.egy_amount);
        });
        frm.set_value('total', total);
        frm.refresh_field('total');
    }
}

// Add handler for teller_invoice_details table
frappe.ui.form.on('Teller Invoice Details', {
    teller_invoice_details_remove: function(frm) {
        // Recalculate total when a row is removed
        let total = 0;
        frm.doc.teller_invoice_details.forEach((item) => {
            total += flt(item.egy_amount);
        });
        frm.set_value('total', total);
        frm.refresh_field('total');
    }
});