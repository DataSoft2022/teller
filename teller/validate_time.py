import frappe
from frappe.utils.data import now, get_datetime
from frappe.utils import nowtime
from datetime import datetime
def cron_validate_interbank_time():
    cur_time = get_datetime(now()).strftime('%H:%M:%S')
    cur_day = get_datetime(now()).date()
    stopWatch = f"23:59:59"
    print(f"time {cur_time} ad cur day is {cur_day}")

    open_interbanks = frappe.get_all('InterBank', filters={'status': 'Open', 'type':'Daily','date':cur_day}, fields=['name','date'])
    for interbank in open_interbanks:
        print(f"interbank {interbank}")
        print(f"type cur_time {type(cur_time)},, type stopWatch {type(stopWatch)}")
        if cur_time == stopWatch:
            frappe.msgprint(f" function is good") 
        frappe.db.set_value('InterBank', interbank.name, 'status', 'Ended')

    # frappe.db.commit()      