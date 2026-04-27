import os

path = r'c:\Users\gabas\OneDrive\Desktop\Booking System\booking-system-backend\controllers\starpayController.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the literal \n sequence with a real newline
# We are looking for backslash followed by n
content = content.replace('\\n', '\n')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Successfully fixed syntax error.")
