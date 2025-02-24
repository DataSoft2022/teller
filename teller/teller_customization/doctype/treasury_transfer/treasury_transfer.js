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

        // Set query for currency_code in currency_transfers table
        frm.set_query("currency_code", "currency_transfers", function(doc) {
            if (!doc.from_treasury) {
                frappe.throw(__('Please select source treasury first'));
                return;
            }
            return {
                query: "teller.teller_customization.doctype.treasury_transfer.treasury_transfer.get_available_currency_codes",
                filters: {
                    "treasury": doc.from_treasury
                }
            };
        });
    },

    refresh: function(frm) {
        if (frm.doc.docstatus !== 1) {
            frm.add_custom_button(__('Get All Currencies'), function() {
                get_all_currencies(frm);
            });
        }
    },

    from_treasury: function(frm) {
        // Clear child table when treasury changes
        frm.clear_table('currency_transfers');
        frm.refresh_field('currency_transfers');
    },

    to_treasury: function(frm) {
        // Update destination accounts if we have currencies
        if (frm.doc.currency_transfers && frm.doc.currency_transfers.length) {
            update_destination_accounts(frm);
        }
    }
});

frappe.ui.form.on('Treasury Transfer Detail', {
    currency_transfers_add: function(frm, cdt, cdn) {
        // Clear the row if it's manually added
        var row = locals[cdt][cdn];
        row.currency_code = '';
        row.currency_display = '';
        row.from_account = '';
        row.to_account = '';
        row.amount = 0;
        frm.refresh_field('currency_transfers');
    },

    currency_code: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row.currency_code && frm.doc.from_treasury) {
            // Get currency details and source account
            frappe.call({
                method: 'teller.teller_customization.doctype.treasury_transfer.treasury_transfer.get_currency_details',
                args: {
                    currency_code: row.currency_code,
                    from_treasury: frm.doc.from_treasury,
                    to_treasury: frm.doc.to_treasury
                },
                callback: function(r) {
                    if (r.message) {
                        // Set currency display name
                        frappe.model.set_value(cdt, cdn, 'currency_display', r.message.currency_name);
                        
                        // Set source account and its balance
                        frappe.model.set_value(cdt, cdn, 'from_account', r.message.from_account);
                        frappe.model.set_value(cdt, cdn, 'from_account_balance', r.message.from_balance);
                        
                        // Set destination account and its balance if available
                        if (r.message.to_account) {
                            frappe.model.set_value(cdt, cdn, 'to_account', r.message.to_account);
                            frappe.model.set_value(cdt, cdn, 'to_account_balance', r.message.to_balance);
                        }
                    }
                }
            });
        }
    },

    amount: function(frm) {
        calculate_total(frm);
    }
});

function get_all_currencies(frm) {
    if (!frm.doc.from_treasury || !frm.doc.to_treasury) {
        frappe.msgprint(__('Please select both treasuries first'));
        return;
    }

    frappe.call({
        method: 'teller.teller_customization.doctype.treasury_transfer.treasury_transfer.get_available_currencies',
        args: {
            from_treasury: frm.doc.from_treasury
        },
        callback: function(r) {
            if (r.message) {
                frm.clear_table('currency_transfers');
                
                r.message.forEach(function(currency) {
                    let row = frm.add_child('currency_transfers');
                    row.currency_code = currency.currency_code;
                    row.currency_display = currency.currency_name;
                    row.from_account = currency.account;
                    row.from_account_balance = currency.balance;
                });
                
                frm.refresh_field('currency_transfers');
                update_destination_accounts(frm);
            }
        }
    });
}

function update_destination_accounts(frm) {
    if (!frm.doc.to_treasury) return;

    let promises = frm.doc.currency_transfers.map(row => {
        return new Promise(resolve => {
            frappe.call({
                method: 'teller.teller_customization.doctype.treasury_transfer.treasury_transfer.get_account_by_currency',
                args: {
                    treasury: frm.doc.to_treasury,
                    currency: row.currency_display
                },
                callback: function(r) {
                    if (r.message) {
                        frappe.model.set_value(row.doctype, row.name, 'to_account', r.message.account);
                        frappe.model.set_value(row.doctype, row.name, 'to_account_balance', r.message.balance);
                    }
                    resolve();
                }
            });
        });
    });

    Promise.all(promises).then(() => {
        frm.refresh_field('currency_transfers');
    });
}

function calculate_total(frm) {
    let total = 0;
    if (frm.doc.currency_transfers) {
        total = frm.doc.currency_transfers.reduce((sum, row) => sum + (row.amount || 0), 0);
    }
    frm.set_value('total_amount', total);
}
