$path = 'c:\Users\gabas\OneDrive\Desktop\Booking System\booking-system-backend\utils\emailService.js';
$content = Get-Content $path;
# Remove lines 1300-1305 and 1814-1819 (1-indexed)
$toRemove = @(1300, 1301, 1302, 1303, 1304, 1305, 1814, 1815, 1816, 1817, 1818, 1819);
$newContent = for ($i=1; $i -le $content.Length; $i++) { 
    if ($toRemove -notcontains $i) { $content[$i-1] } 
};
$newContent | Set-Content $path;
