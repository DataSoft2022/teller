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
    // Set focus on client field
    setTimeout(function () {
      frm.get_field("client").$input.focus();
    }, 100);

    // Make invoice info section collapsible and expanded by default
    frm.toggle_display('section_break_ugcr', true);
    frm.set_df_property('section_break_ugcr', 'collapsible', 1);
    frm.set_df_property('section_break_ugcr', 'collapsed', 0);

    // filter clients based on client type
    frm.set_query("client", function (doc) {
      return {
        filters: {
          custom_type: doc.client_type,
        },
      };
    });
    // add ledger button in refresh To Teller Invoice
    frm.events.show_general_ledger(frm);
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
    // get the information for Egyptian
    if (
      frm.doc.client_type == "Egyptian" ||
      frm.doc.client_type == "Foreigner"
    ) {
      if (frm.doc.client) {
        //test add
        var customerName = frm.doc.client;

        //////////////

        frappe.call({
          method: "frappe.client.get",
          args: {
            doctype: "Customer",
            name: frm.doc.client,
          },
          callback: function (r) {
            // set the fields with r.message.fieldname
            frm.set_value("customer_name", r.message.customer_name);
            frm.set_value("gender", r.message.gender);
            frm.set_value("card_type", r.message.custom_card_type);

            frm.set_value("phone", r.message.custom_phone);
            frm.set_value("mobile_number", r.message.custom_mobile);
            frm.set_value("work_for", r.message.custom_work_for);
            frm.set_value("address", r.message.custom_address);
            frm.set_value("nationality", r.message.custom_nationality);
            frm.set_value("issue_date", r.message.custom_issue_date);
            frm.set_value("address", r.message.custom_address);
            frm.set_value("expired", r.message.custom_expired);
            frm.set_value("place_of_birth", r.message.custom_place_of_birth);
            frm.set_value("date_of_birth", r.message.custom_date_of_birth);
            frm.set_value("job_title", r.message.custom_job_title);
            if (frm.doc.card_type == "National ID") {
              frm.set_value("national_id", r.message.custom_national_id);
            } else if (frm.doc.card_type == "Passport") {
              frm.set_value(
                "passport_number",
                r.message.custom_passport_number
              );
            } else {
              frm.set_value(
                "military_number",
                r.message.custom_military_number
              );
            }
          },
        });
      } else {
        // clear the fields
        frm.set_value("customer_name", "");
        frm.set_value("gender", "");
        // frm.set_value("card_type", "");
        // frm.set_value("card_info", "");
        frm.set_value("mobile_number", "");
        frm.set_value("work_for", "");
        frm.set_value("phone", "");
        frm.set_value("address", "");
        frm.set_value("nationality", "");
        frm.set_value("issue_date", "");
        frm.set_value("expired", "");
        frm.set_value("place_of_birth", "");
        frm.set_value("date_of_birth", "");
        frm.set_value("job_title", "");
      }
    }
    // get the information for company
    else if (
      frm.doc.client_type == "Company" ||
      frm.doc.client_type == "Interbank"
    ) {
      if (frm.doc.client) {
        frappe.call({
          method: "frappe.client.get",
          args: {
            doctype: "Customer",
            name: frm.doc.client,
          },
          callback: function (r) {
            // set the fields with r.message.fieldname
            frm.set_value("company_name", r.message.customer_name);
            frm.set_value(
              "company_activity",
              r.message.custom_company_activity
            );
            frm.set_value(
              "company_commercial_no",
              r.message.custom_commercial_no
            );

            frm.set_value(
              "start_registration_date",
              r.message.custom_start_registration_date
            );

            frm.set_value(
              "end_registration_date",
              r.message.custom_end_registration_date
            );
            frm.set_value("company_num", r.message.custom_company_no);
            frm.set_value("comoany_address", r.message.custom_comany_address1);
            frm.set_value("is_expired1", r.message.custom_is_expired);
            frm.set_value("interbank", r.message.custom_interbank);
            frm.set_value("company_legal_form", r.message.custom_legal_form);
          },
        });
      } else {
        // clear the fields
        frm.set_value("company_name", "");
        frm.set_value("company_activity", "");
        frm.set_value("company_commercial_no", "");
        frm.set_value("company_num", "");
        frm.set_value("end_registration_date", "");
        frm.set_value("start_registration_date", "");
        frm.set_value("comoany_address", "");
        frm.set_value("is_expired1", "");
        frm.set_value("interbank", "");
        frm.set_value("company_legal_form", "");
      }
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
          
          // Optionally disable form
          frm.disable_save();
        }
      }
    });
  }
}

//  add contact list to company
function update_contact_list(frm) {
  if (!frm.doc.client) {
    console.error("client not found in form");
    return;
  }
  frappe.call({
    method: "frappe.client.get_list",
    args: {
      doctype: "Contact",
      filters: [
        ["Dynamic Link", "link_doctype", "=", "Customer"],
        ["Dynamic Link", "link_name", "=", frm.doc.client],
      ],
      fields: ["name", "email_id", "phone"],
    },
    callback: function (r) {
      if (r.message) {
        // console.log("contact list are", r.message);
        // let html = "<ul>";
        // r.message.forEach((contact) => {
        //   // html += `<li>${contact.name}: ${contact.email_id} / ${contact.phone}</li>`;
        //   html += `<li><a href="#Form/Contact/${contact.name}" target="_blank">${contact.name}</a>: ${contact.email_id} / ${contact.phone}</li>`;
        // });
        // html += "</ul>";
        // frm.fields_dict["contact_list"].$wrapper.html(html);
        console.log("contact list are", r.message);
        let html = "<ul>";
        r.message.forEach((contact) => {
          html += `<li><a href="#" data-contact="${contact.name}" class="contact-link">${contact.name}</a>: ${contact.email_id} / ${contact.phone}</li>`;
        });
        html += "</ul>";
        frm.fields_dict["contact_list"].$wrapper.html(html);

        // Add click event listeners to the links
        frm.fields_dict["contact_list"].$wrapper
          .find(".contact-link")
          .on("click", function (e) {
            e.preventDefault();
            var contact_name = $(this).attr("data-contact");
            frappe.set_route("Form", "Contact", contact_name);
          });
      }
    },
  });
}

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
        } else {
          frappe.throw(__("Commissar not found"));
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
    code(frm, cdt, cdn) {
      var row = locals[cdt][cdn];
      frappe.call({
        method: "frappe.client.get_list",
        args: {
          doctype: "Currency",
          fields: ["name", "custom_currency_code"],
          filters: [["custom_currency_code", "=", row.code]],
        },
        callback: function (response) {
          let currencies = response.message || [];
          // console.log("Fetched currencies:", currencies);
  
          // Assuming you need to update something based on these currencies
          if (currencies.length > 0) {
            // Update the form field with the first currency's details as an example
            let currency = currencies[0]; // Take the first matched currency
            // console.log("Selected currency:", currency);
  
            // Example: Update a field in the current row
            frappe.model.set_value(cdt, cdn, "currency_code", currency.name);
            frappe.model.set_value(cdt, cdn, "currency", currency.name);

            // Optionally, you can set additional fields if needed
            // frappe.model.set_value(cdt, cdn, "another_field", currency.another_field);
          } else {
            console.log("No matching currencies found.");
          }
        },
      });
///////////////////////////////Fixing for user permission\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
///////////////////////////////Fixing for user permission\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
      
if (row.code) {
  console.log("Code entered:", row.code);

  // Step 1: Fetch User Permissions for Accounts
  frappe.call({
      method: "frappe.client.get_list",
      args: {
          doctype: "User Permission",
          filters: {
            // user: 'andrew@datasofteg.com',
              user: frappe.session.user, // Filter by the current user
              allow: "Account" // Ensure permissions are for the Account doctype
          },
          fields: ["for_value"]
      },
      callback: function(permissionResponse) {
          // console.log("User Permission (response):", permissionResponse.message);

          if (permissionResponse.message && permissionResponse.message.length > 0) {
            // console.log("for_value:", permissionResponse.message);
              let userAccounts = permissionResponse.message.map(record => record.for_value);
              // console.log("Accounts from User Permission (userAccounts):", userAccounts);

              // Step 2: Check each user-permitted account for matching custom_currency_code
              frappe.call({
                  method: "frappe.client.get_list",
                  args: {
                      doctype: "Account",
                      filters: {
                          parent_account: ["in", userAccounts], // Accounts must be under the parent_account from User Permission
                          custom_currency_code: row.code // Match custom_currency_code with the entered code
                      },
                      fields: ["name", "custom_currency_code", "parent_account"]
                  },
                  callback: function(accountResponse) {
                      // console.log("Account fetch response:", accountResponse);

                      if (accountResponse.message && accountResponse.message.length > 0) {
                          let matchingAccount = accountResponse.message; // Use the first match
                          console.log("Matching Account Found:", matchingAccount);
                          for (let cur of matchingAccount){
                            if (cur.custom_currency_code === row.code){
                              // console.log("ssss",cur.name)
                              frappe.model.set_value(cdt, cdn, "paid_from", cur.name);
  
                            }
                          }
  
                          // Set the account name in the paid_from field
                      } else {
                          console.log(`No matching Account found for code: ${row.code}`);
                          frappe.msgprint(`No matching Account found for code: ${row.code}`);
                          frappe.model.set_value(cdt, cdn, "paid_from", null); // Clear the field
                      }
                  }
              });
          } else {
              console.log("No User Permissions found for Accounts.");
              frappe.msgprint("No User Permissions found for Accounts.");
              frappe.model.set_value(cdt, cdn, "paid_from", null); // Clear the field
          }
      }
  });
} else {
  console.log("Code field is empty. No action taken.");
}




    },
  });
///////////////////////////////Function get account by User\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
///////////////////////////////Function get account by User\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

function get_account (frm, child){

  if (child.code) {
    console.log("Code entered222222:", child.code);
  
  //   // Step 1: Fetch User Permissions for Accounts
    frappe.call({
        method: "frappe.client.get_list",
        args: {
            doctype: "User Permission",
            filters: {
              // user: 'andrew@datasofteg.com',
                user: frappe.session.user, // Filter by the current user
                allow: "Account" // Ensure permissions are for the Account doctype
            },
            fields: ["for_value"]
        },
        callback: function(permissionResponse) {
            console.log("User Permission (response):", permissionResponse.message);
  
            if (permissionResponse.message && permissionResponse.message.length > 0) {
              console.log("for_value:", permissionResponse.message);
                let userAccounts = permissionResponse.message.map(record => record.for_value);
                console.log("Accounts from User Permission (userAccounts):", userAccounts);
  
                // Step 2: Check each user-permitted account for matching custom_currency_code
                frappe.call({
                    method: "frappe.client.get_list",
                    args: {
                        doctype: "Account",
                        filters: {
                            parent_account: ["in", userAccounts], // Accounts must be under the parent_account from User Permission
                            custom_currency_code: child.code // Match custom_currency_code with the entered code
                        },
                        fields: ["name", "custom_currency_code", "parent_account"]
                    },
                    callback: function(accountResponse) {
                        console.log("Account fetch response:", accountResponse);
  
                        if (accountResponse.message && accountResponse.message.length > 0) {
                            let matchingAccount = accountResponse.message; // Use the first match
                            console.log("Matching Account Found:", matchingAccount);
                            for (let cur of matchingAccount){
                              if (cur.custom_currency_code === child.code){
                                console.log("ssss",cur.name)
                                frappe.model.set_value(child.doctype, child.name, "paid_from", cur.name);
    
                              }
                            }
    
                            // Set the account name in the paid_from field
                        } else {
                            console.log(`No matching Account found for code: ${child.code}`);
                            frappe.msgprint(`No matching Account found for code: ${child.code}`);
                            frappe.model.set_value(child.doctype, child.name, "paid_from", null); // Clear the field
                        }
                    }
                });
            } else {
                console.log("No User Permissions found for Accounts.");
                frappe.msgprint("No User Permissions found for Accounts.");
                frappe.model.set_value(child.doctype, child.name, "paid_from", null); // Clear the field
            }
        }
    });
  } else {
    console.log("Code field is empty. No action taken.");
  }
  
}

/////////////////////////////////////////////////////
frappe.ui.form.on('Teller Invoice', {
  refresh: function(frm) {
    if (frm.doc.docstatus == 1) {
      frm.add_custom_button(__("Return / Credit Note")
      , ()=>{
        frm.call({
          method: "teller.teller_customization.doctype.teller_invoice.teller_invoice.make_sales_return",
          args:{
            doc:frm.doc,
          },

          callback: (r) => {
          
            if (r) {
              console.log("Respone 22",r.message)
              let name_doc = r.message.new_teller_invoice
              // frappe.msgprint(__("Accounting Entries are reposted"));
              frappe.set_route('Form', "Teller Invoice", name_doc);

            }
          },
        });
      }
      , __("Create"));
    }
  }
});

function make_sales_return(frm) {
  
}


frappe.ui.form.on("Teller Invoice",{
  client_type(frm){
if (frm.doc.client_type == "Foreigner"){
  frm.set_value("card_type","Passport")
  frm.refresh_field("card_type");
}
if (frm.doc.client_type == "Egyptian"){
  frm.set_value("card_type","National ID")
  frm.refresh_field("card_type");
}
  },
  async fetch_national_id(frm){
    let x =  await frappe.db.get_doc("Customer",cur_frm.doc.fetch_national_id)
    console.log("xxxxxxxxxxx",x.custom_is_expired )
    if(x.custom_is_expired == 1){
      frappe.throw({
        title:__("Customer Expired"),
        message:__(" Expired Registration Date For Client")
      })

    }
  
  },
  validate(frm){
    if(frm.doc.is_expired1 == 1){
      frappe.throw({
        title:__("Customer Expired"),
        message:__(" Expired Registration Date For Client")
      })
  }
  }
})