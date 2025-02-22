// Copyright (c) 2025, Mohamed AbdElsabour and contributors
// For license information, please see license.txt

// frappe.ui.form.on("Treasury Transfer", {
// 	refresh(frm) {

// 	},
// });

frappe.ui.form.on("Treasury Transfer", {
    setup: function(frm) {
        // Set query for to_treasury to exclude the from_treasury
        frm.set_query("to_treasury", function() {
            return {
                filters: {
                    name: ["!=", frm.doc.from_treasury || ""]
                }
            };
        });
    },

    refresh: function(frm) {
        // Only handle balance updates for new or unsaved documents
        if (frm.is_new()) {
            frm.set_value("currency_code", "");
            frm.set_value("currency_display", "");
            frm.set_value("from_account", "");
            frm.set_value("from_account_balance", "");
            frm.set_value("to_account", "");
            frm.set_value("to_account_balance", "");
        }
        
        // Only update balances if document is not submitted
        if (!frm.doc.__islocal && frm.doc.docstatus !== 1) {
            if (frm.doc.from_account) {
                frm.trigger('update_from_balance');
            }
            if (frm.doc.to_account) {
                frm.trigger('update_to_balance');
            }
        }
    },

    from_treasury: function(frm) {
        // Clear dependent fields when treasury changes
        frm.set_value("currency_code", "");
        frm.set_value("currency_display", "");
        frm.set_value("from_account", "");
        frm.set_value("from_account_balance", "");
        frm.set_value("to_treasury", "");
        frm.set_value("to_account", "");
        frm.set_value("to_account_balance", "");
    },

    currency_code: function(frm) {
        if (frm.doc.currency_code && frm.doc.from_treasury) {
            // Get the account for the entered currency code
            frappe.call({
                method: "teller.teller_customization.doctype.treasury_transfer.treasury_transfer.get_account_from_code",
                args: {
                    treasury: frm.doc.from_treasury,
                    currency_code: frm.doc.currency_code
                },
                callback: function(r) {
                    if (r.message) {
                        frm.set_value("from_account", r.message.account);
                        frm.set_value("currency_display", r.message.currency);
                        frm.trigger('update_from_balance');
                    } else {
                        frappe.msgprint(__("No account found for currency code {0} in this treasury", [frm.doc.currency_code]));
                        frm.set_value("from_account", "");
                        frm.set_value("from_account_balance", "");
                        frm.set_value("currency_display", "");
                    }
                }
            });
        }
    },

    to_treasury: function(frm) {
        if (frm.doc.to_treasury && frm.doc.currency_display) {
            // Get the matching account in the destination treasury
            frappe.call({
                method: "teller.teller_customization.doctype.treasury_transfer.treasury_transfer.get_account_by_currency",
                args: {
                    treasury: frm.doc.to_treasury,
                    currency: frm.doc.currency_display
                },
                callback: function(r) {
                    if (r.message) {
                        frm.set_value("to_account", r.message);
                        frm.trigger('update_to_balance');
                    } else {
                        frappe.msgprint(__("No matching account found in the destination treasury for currency {0}", [frm.doc.currency_display]));
                        frm.set_value("to_account", "");
                        frm.set_value("to_account_balance", "");
                    }
                }
            });
        }
    },
    
    update_from_balance: function(frm) {
        // Only update balance if document is not submitted
        if (frm.doc.from_account && frm.doc.docstatus !== 1) {
            frappe.call({
                method: "teller.teller_customization.doctype.treasury_transfer.treasury_transfer.get_account_balance",
                args: {
                    account: frm.doc.from_account
                },
                callback: function(r) {
                    if (r.message !== undefined) {
                        frm.set_value("from_account_balance", r.message);
                    }
                }
            });
        }
    },
    
    update_to_balance: function(frm) {
        // Only update balance if document is not submitted
        if (frm.doc.to_account && frm.doc.docstatus !== 1) {
            frappe.call({
                method: "teller.teller_customization.doctype.treasury_transfer.treasury_transfer.get_account_balance",
                args: {
                    account: frm.doc.to_account
                },
                callback: function(r) {
                    if (r.message !== undefined) {
                        frm.set_value("to_account_balance", r.message);
                    }
                }
            });
        }
    }
});
