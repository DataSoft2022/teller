frappe.ui.form.on('Teller Invoice Details', {
    currency_code: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        console.log("Currency code changed:", row.currency_code); // Debug message
        frappe.msgprint("Currency code entered: " + row.currency_code); // Visual debug
        
        if (row.currency_code) {
            // First get the account based on currency code
            frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Account',
                    filters: {
                        'custom_currency_code': row.currency_code,
                        'account_type': ['in', ['Bank', 'Cash']]
                    },
                    fields: ['name', 'account_currency'],
                    limit: 1
                },
                callback: function(account_response) {
                    console.log("Account response:", account_response); // Debug message
                    if (account_response.message && account_response.message.length > 0) {
                        let account = account_response.message[0];
                        
                        // Set the account
                        frappe.model.set_value(cdt, cdn, 'account', account.name);
                        
                        // Set the currency
                        frappe.model.set_value(cdt, cdn, 'currency', account.account_currency);
                        
                        // Now get the exchange rate
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
                                console.log("Rate response:", rate_response); // Debug message
                                if (rate_response.message && rate_response.message.length > 0) {
                                    frappe.model.set_value(cdt, cdn, 'exchange_rate', 
                                        rate_response.message[0].custom_selling_exchange_rate);
                                } else {
                                    frappe.msgprint(__('No exchange rate found for currency ' + account.account_currency));
                                }
                            }
                        });
                    } else {
                        frappe.msgprint(__('No account found for currency code ' + row.currency_code));
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
    }
} 