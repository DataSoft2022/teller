frappe.ui.form.on('Sales Invoice', {
    validate: function(frm) {
        frm.doc.items.forEach(function(item) {
            // Assuming 'currency_number' is the field name for the custom currency number
            var currencyNumber = item.currency_number;
            get_code=item.item_code
            console.log(get_code)

            // Fetch currency and rate based on the currency number (you'll need to implement this logic)
            // var currency = getCurrencyFromNumber(currencyNumber);
            // var rate = getRateForCurrency(currency);

            // Set the currency and rate fields
            // frappe.model.set_value(item.doctype, item.name, 'item_code', get_code);
            // frappe.model.set_value(item.doctype, item.name, 'rate', rate);
        });
    }


});