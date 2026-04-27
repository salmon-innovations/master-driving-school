import os

path = r'c:\Users\gabas\OneDrive\Desktop\Booking System\booking-system-backend\controllers\starpayController.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix checkStatus: when booking.status is 'cancelled', return starpayState CANCEL not CLOSE
old = """        if (booking.status !== 'pending') {
            const successfulLocalStatus = ['paid', 'partial_payment'].includes(String(booking.status || '').toLowerCase());
            return res.json({
                success: true,
                localStatus: booking.status,
                starpayState: successfulLocalStatus ? 'SUCCESS' : 'CLOSE',
                bookingId: booking.id,
                amount: booking.total_amount,
            });
        }"""

new = """        if (booking.status !== 'pending') {
            const successfulLocalStatus = ['paid', 'partial_payment'].includes(String(booking.status || '').toLowerCase());
            const isCancelled = String(booking.status || '').toLowerCase() === 'cancelled';
            return res.json({
                success: true,
                localStatus: booking.status,
                starpayState: successfulLocalStatus ? 'SUCCESS' : (isCancelled ? 'CANCEL' : 'CLOSE'),
                bookingId: booking.id,
                amount: booking.total_amount,
            });
        }"""

if old in content:
    content = content.replace(old, new)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("SUCCESS: checkStatus fix applied.")
else:
    print("ERROR: target string not found. Check the file manually.")
