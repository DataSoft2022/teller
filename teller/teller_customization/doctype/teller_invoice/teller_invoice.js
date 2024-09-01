// Copyright (c) 2024, Mohamed AbdElsabour and contributors
// For license information, please see license.txt

frappe.ui.form.on("Teller Invoice", {
  // setup basic inforamation

  setup: function (frm) {
    // filters accounts with cash ,is group False and account currency not EGY

    frm.fields_dict["transactions"].grid.get_field("paid_from").get_query =
      function () {
        var account_types = ["Cash"];
        return {
          filters: {
            account_type: ["in", account_types],
            account_currency: ["!=", "EGP"],
            is_group: 0,
          },
        };
      };

    // get query for codes the belongs to currenct user
    frm.fields_dict["transactions"].grid.get_field("currency_code").get_query =
      function () {
        let currentUser = frappe.session.logged_in_user;
        return {
          filters: {
            user: currentUser,
          },
        };
      };
  },

  // add commissar to company

  // add_commissar: function (frm) {
  //   // frappe.route_options = { customer: frm.doc.client };

  //   // frappe.set_route("Form", "Customer", frm.doc.client);

  //   if (!frm.doc.client) {
  //     frappe.msgprint(__("Please select Company first."));
  //     return;
  //   }

  //   // create contact for this client of type company
  //   frappe.model.with_doctype("Contact", function () {
  //     var doc = frappe.model.get_new_doc("Contact");
  //     doc.links = [
  //       {
  //         link_doctype: "Customer",
  //         link_name: frm.doc.client,
  //       },
  //     ];

  //     var d = new frappe.ui.Dialog({
  //       title: __("Create a new contact"),
  //       fields: [
  //         {
  //           fieldtype: "Data",
  //           fieldname: "first_name",
  //           label: __("Commissar Name"),
  //           reqd: 1,
  //         },
  //         // { fieldtype: "Data", fieldname: "last_name", label: __("Last Name") },
  //         {
  //           fieldtype: "Data",
  //           fieldname: "custom_com_address",
  //           label: __("Address"),
  //         },
  //         {
  //           fieldtype: "Data",
  //           fieldname: "custom_com_phone",
  //           label: __("Phone"),
  //         },
  //         {
  //           fieldtype: "Data",
  //           fieldname: "custom_national_id",
  //           label: __("National ID"),
  //           reqd: 1,
  //         },
  //       ],
  //       primary_action: function () {
  //         d.hide();
  //         $.extend(doc, d.get_values());
  //         frappe.call({
  //           method: "frappe.client.insert",
  //           args: {
  //             doc: doc,
  //           },
  //           callback: function (r) {
  //             if (r.message) {
  //               // update_contact_list(frm);
  //               frappe.show_alert({
  //                 message: __("Contact added successfully"),
  //                 indicator: "green",
  //               });
  //             }
  //           },
  //         });
  //       },
  //       primary_action_label: __("Create"),
  //     });
  //     d.show();
  //   });
  // },

  refresh(frm) {
    // set the focus on the fetch_national_id field when the doctype is refreshed
    setTimeout(function () {
      frm.get_field("fetch_national_id").$input.focus();
    }, 100);
    frappe.ui.keys.on("alt+s", function (e) {
      console.log("alt + s was pressed");

      e.preventDefault();

      // if (frm.doc.docstatus === 0) {
      //   frm
      //     .save()
      //     .then(() => {
      //       console.log("Form saved");
      //       return frm.savesubmit();
      //     })
      //     .then(() => {
      //       console.log("Form submitted");
      //       frm.print_doc();
      //       console.log("Form printed");
      //     })
      //     .catch((error) => console.error("Error:", error));
      // }

      if (frm.doc.docstatus === 0) {
        frm
          .save()
          .then(() => {
            console.log("Form saved");

            // Manually submit the form without showing confirmation
            frappe.call({
              method: "frappe.client.submit",
              args: {
                doc: frm.doc,
              },
              callback: function (response) {
                if (!response.exc) {
                  console.log("Form submitted");
                  frm.print_doc();
                  console.log("Form printed");
                } else {
                  console.error("Error submitting:", response.exc);
                }
              },
            });
          })
          .catch((error) => console.error("Error:", error));
      }

      ///////////////////
    });

    // handle add contact
    // if (frm.doc.client) {
    //   // update contact list
    //   update_contact_list(frm);
    // } else {
    //   frm.fields_dict["contact_list"].$wrapper.html(""); // clear the HTML

    //   frm.set_value("contact_list", "");
    // }

    //test get total amount of client
    // var customer_amount = frm
    //   .call({
    //     method: "customer_total_amount",
    //     doc: frm.doc,
    //   })
    //   .then((r) => {
    //     if (r.message) {
    //       // console.log(r.message);

    //       return r.message;
    //     }
    //   });

    // console.log(customer_amount, "customer_amount from day2");

    //////////////////
    // get last submitted Teller  invoice
    // frappe
    //   .call({
    //     method: "frappe.client.get_list",
    //     args: {
    //       doctype: "Teller Invoice",
    //       fields: ["name", "receipt_number"],
    //       limit: 1,
    //       order_by: "creation desc",
    //       filters: {
    //         docstatus: 1,
    //       },
    //     },
    //   })
    //   .then((r) => {
    //     if (r.message) {
    //       let last_invoice = r.message[0].name;
    //       console.log("last invoice is", last_invoice);
    //     }
    //   });

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

  fetch_national_id(frm) {
    if (frm.doc.fetch_national_id) {
      if (
        frm.doc.client_type == "Egyptian" &&
        frm.doc.card_type == "National ID"
      ) {
        // validateNationalId(frm, frm.doc.fetch_national_id);
        let nationalId = frm.doc.fetch_national_id;

        frappe.call({
          method:
            "teller.teller_customization.doctype.teller_invoice.teller_invoice.check_client_exists",
          args: {
            doctype_name: nationalId,
          },
          callback: function (r) {
            if (r.message) {
              console.log(r.message, "exists");
              frm.set_value("client", nationalId).then(() => {
                frm.refresh_field("client");
              });
            } else {
              frm.set_value("client", "").then(() => {
                frm.refresh_field("client");
                if (validateNationalId(frm, nationalId)) {
                  frm.set_value("national_id", nationalId);
                } else {
                  frm.set_value("national_id", "");
                }
              });

              //
            }
          },
        });
      } else if (frm.doc.client_type == "Company") {
        // validateNationalId(frm, frm.doc.fetch_national_id);
        let commiricalNo = frm.doc.fetch_national_id;

        frappe.call({
          method:
            "teller.teller_customization.doctype.teller_invoice.teller_invoice.check_client_exists",
          args: {
            doctype_name: commiricalNo,
          },
          callback: function (r) {
            if (r.message) {
              console.log(r.message, "exists");
              frm.set_value("client", commiricalNo).then(() => {
                frm.refresh_field("client");
              });
            } else {
              frm.set_value("client", "").then(() => {
                frm.set_value("company_commercial_no", commiricalNo);
              });
            }
          },
        });
      }
      // fetch or create client with passport number
      else if (
        (frm.doc.client_type == "Egyptian" ||
          frm.doc.client_type == "Foreigner") &&
        frm.doc.card_type == "Passport"
      ) {
        // frappe.msgprint("from passport");
        let passportNumber = frm.doc.fetch_national_id;

        frappe.call({
          method:
            "teller.teller_customization.doctype.teller_invoice.teller_invoice.check_client_exists",
          args: {
            doctype_name: passportNumber,
          },
          callback: function (r) {
            if (r.message) {
              console.log(r.message, "exists");
              frm.set_value("client", passportNumber).then(() => {
                frm.refresh_field("client");
              });
            } else {
              frm.set_value("client", "").then(() => {
                frm.refresh_field("client");
                if (validateNationalId(frm, passportNumber)) {
                  frm.set_value("passport_number", passportNumber);
                } else {
                  frm.set_value("passport_number", "");
                }
              });

              //
            }
          },
        });
      }
    } else {
      frm.set_value("client", "");
      frm.set_value("national_id", "");
    }
  },

  // Get customer information if exists
  client: function (frm) {
    // start test add contact information
    // if (frm.doc.client) {
    //   update_contact_list(frm);
    // } else {
    //   frm.fields_dict["contact_list"].$wrapper.html(""); // clear the HTML

    //   frm.set_value("contact_list", "");
    // }

    // let testAllowed = await fetchAllowedAmount();
    // console.log("Test allowed amount", testAllowed);

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
  special_price: function (frm) {
    if (frm.doc.docstatus == 0) {
      let total_currency_amount = 0;

      frm.doc.transactions.forEach((row) => {
        if (row.paid_from) {
          frappe.call({
            method:
              "teller.teller_customization.doctype.teller_invoice.teller_invoice.get_currency",
            args: {
              account: row.paid_from,
            },
            callback: function (r) {
              console.log(r.message[2]);
              selling_special_rate = r.message[2];
              row.rate = selling_special_rate;
              console.log(r.message[2]);
              let currency_total = row.rate * row.usd_amount;
              row.total_amount = currency_total;

              console.log(
                `the total of ${row.currency} is ${row.total_amount}`
              );

              total_currency_amount += currency_total;
              console.log("from loop: " + total_currency_amount);
              frm.refresh_field("transactions");
              frm.set_value("total", total_currency_amount);
            },
          });
        }
      });
      console.log("from outer loop: " + total_currency_amount);
    }
  },

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
      frappe.msgprint({
        message:
          '<div style="background-color: #f8d7da; color: #721c24; padding: 10px; border-radius: 5px; font-family: Arial, sans-serif; font-size: 14px;">Please enter Customer to validate the transaction</div>',
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

//  Transactions currency table
frappe.ui.form.on("Entry Child", {
  // filter accounts

  paid_from: function (frm, cdt, cdn) {
    var acc_currency;
    var row = locals[cdt][cdn];
    if (row.paid_from) {
      frappe.call({
        method:
          "teller.teller_customization.doctype.teller_invoice.teller_invoice.get_currency",
        args: {
          account: row.paid_from,
        },
        callback: function (r) {
          console.log(r.message);
          console.log(r.message[0]);
          let curr = r.message[0];
          let currency_rate = r.message[1];
          acc_currency = curr;
          let currencyCode = r.message[3];
          console.log("the currency code is " + currencyCode);

          frappe.model.set_value(cdt, cdn, "currency", curr);

          frappe.model.set_value(cdt, cdn, "rate", currency_rate);
          frappe.model.set_value(cdt, cdn, "code", currencyCode);
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
      frm.doc.transactions.forEach((item) => {
        total += item.total_amount;
      });
      frm.set_value("total", total);
    }
  },
  transactions_remove: function (frm) {
    let total = 0;
    frm.doc.transactions.forEach((item) => {
      total += item.total_amount;
    });
    frm.set_value("total", total);
  },
  currency_code(frm, cdt, cdn) {
    let row = locals[cdt][cdn];
    let sessionUser = frappe.session.logged_in_user;
    console.log("field is triger");
    frappe.call({
      method:
        "teller.teller_customization.doctype.teller_invoice.teller_invoice.get_current_user_currency_codes",
      args: {
        current_user: sessionUser,
        code: row.currency_code,
      },
      callback: function (r) {
        if (!r.exc) {
          // console.log(r.message[0]["account"]);
          let userAccount = r.message[0].account;
          console.log("the user account is", userAccount);
          frappe.model.set_value(cdt, cdn, "paid_from", userAccount);
        }
      },
    });
  },
});
function set_branch_and_shift(frm) {
  frappe.call({
    method: "frappe.client.get",
    args: {
      doctype: "Branch",
      filters: {
        custom_active: 1,
      },
    },
    callback: function (r) {
      if (!r.exc) {
        let branch = r.message.name;
        frm.set_value("branch_no", branch);
      }
    },
  });
  // Set the the active open shift and current user
  frappe.call({
    method: "frappe.client.get_value",
    args: {
      doctype: "OPen Shift",
      filters: { active: 1 },
      fieldname: ["name", "current_user"],
    },
    callback: function (r) {
      if (!r.exc) {
        let shift = r.message.name;
        let current_user = r.message.current_user;

        frm.set_value("shift", shift);
        frm.set_value("teller", current_user);
      }
    },
  });
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
