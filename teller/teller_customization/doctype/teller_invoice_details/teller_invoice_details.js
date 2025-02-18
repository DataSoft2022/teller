frappe.ui.form.on('Teller Invoice Details', {
    currency_code: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        let parentDoc = frappe.get_doc('Teller Invoice', row.parent);
        console.log("Currency code changed:", row.currency_code); // Debug message
        
        if (row.currency_code && parentDoc.treasury_code) {
            // Get account and currency based on currency code AND treasury code
            frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Account',
                    filters: {
                        'custom_currency_code': row.currency_code,
                        'account_type': ['in', ['Bank', 'Cash']],
                        'custom_teller_treasury': parentDoc.treasury_code
                    },
                    fields: ['name', 'account_currency'],
                    limit: 1
                },
                callback: function(account_response) {
                    console.log("Account response:", account_response); // Debug message
                    if (account_response.message && account_response.message.length > 0) {
                        let account = account_response.message[0];
                        
                        // Set the currency first
                        frappe.model.set_value(cdt, cdn, 'currency', account.account_currency);
                        
                        // Get exchange rate before setting account
                        frappe.call({
                            method: 'frappe.client.get_list',
                            args: {
                                doctype: 'Currency Exchange',
                                filters: {
                                    'from_currency': account.account_currency,
                                    'to_currency': 'EGP'
                                },
                                fields: ['custom_selling_exchange_rate', 'exchange_rate'],
                                order_by: 'date desc, creation desc',
                                limit: 1
                            },
                            callback: function(rate_response) {
                                console.log("Rate response:", rate_response); // Debug message
                                if (rate_response.message && rate_response.message.length > 0) {
                                    let rate = rate_response.message[0];
                                    // Use selling exchange rate if available, otherwise use regular exchange rate
                                    let exchange_rate = rate.custom_selling_exchange_rate || rate.exchange_rate;
                                    
                                    if (exchange_rate) {
                                        // Set both the account and exchange rate together to prevent race conditions
                                        frappe.model.set_value(cdt, cdn, 'exchange_rate', exchange_rate);
                                        frappe.model.set_value(cdt, cdn, 'account', account.name);
                                        
                                        // Get account balance
                                        frappe.call({
                                            method: 'teller.teller_customization.doctype.teller_invoice.teller_invoice.account_from_balance',
                                            args: {
                                                paid_from: account.name
                                            },
                                            callback: function(balance_response) {
                                                if (balance_response.message) {
                                                    frappe.model.set_value(cdt, cdn, 'balance_after', balance_response.message);
                                                }
                                            }
                                        });
                                    } else {
                                        frappe.msgprint(__('No valid exchange rate found for currency ' + account.account_currency));
                                    }
                                } else {
                                    frappe.msgprint(__('No exchange rate record found for currency ' + account.account_currency));
                                }
                            }
                        });
                    } else {
                        frappe.msgprint(__('No account found for currency code ' + row.currency_code + ' in treasury ' + parentDoc.treasury_code));
                    }
                }
            });
        } else if (!parentDoc.treasury_code) {
            frappe.msgprint(__('Please ensure treasury code is set before selecting currency code'));
        }
    },

    account: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        // Store the originally selected account
        let selectedAccount = row.account;
        
        // Only proceed if the exchange rate is not already set
        if (selectedAccount && !row.exchange_rate) {
            // Get currency and currency code from account
            frappe.call({
                method: 'frappe.client.get',
                args: {
                    doctype: 'Account',
                    name: selectedAccount
                },
                callback: function(response) {
                    if (response.message) {
                        let account = response.message;
                        
                        // Set currency code and currency without changing the account
                        frappe.model.set_value(cdt, cdn, 'currency_code', account.custom_currency_code);
                        frappe.model.set_value(cdt, cdn, 'currency', account.account_currency);
                        
                        // Ensure the account stays as originally selected
                        frappe.model.set_value(cdt, cdn, 'account', selectedAccount);
                        
                        // Only get exchange rate if it's not already set
                        if (!row.exchange_rate) {
                            frappe.call({
                                method: 'frappe.client.get_list',
                                args: {
                                    doctype: 'Currency Exchange',
                                    filters: {
                                        'from_currency': account.account_currency,
                                        'to_currency': 'EGP'
                                    },
                                    fields: ['custom_selling_exchange_rate', 'exchange_rate'],
                                    order_by: 'date desc, creation desc',
                                    limit: 1
                                },
                                callback: function(rate_response) {
                                    if (rate_response.message && rate_response.message.length > 0) {
                                        let rate = rate_response.message[0];
                                        let exchange_rate = rate.custom_selling_exchange_rate || rate.exchange_rate;
                                        if (exchange_rate) {
                                            frappe.model.set_value(cdt, cdn, 'exchange_rate', exchange_rate);
                                            // Ensure account is still correct after setting exchange rate
                                            frappe.model.set_value(cdt, cdn, 'account', selectedAccount);
                                        }
                                    }
                                }
                            });
                        }
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
        
        // Update balance after if it exists
        if (row.balance_after !== undefined) {
            let new_balance = flt(row.balance_after) + flt(amount);
            frappe.model.set_value(cdt, cdn, 'balance_after', new_balance);
        }
    }
} 