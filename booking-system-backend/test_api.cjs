const fetch = require('node-fetch');
fetch('http://localhost:5000/api/schedules/slots?branch_id=2&type=TDC')
    .then(res => res.json())
    .then(data => console.log(JSON.stringify(data, null, 2)))
    .catch(console.error);
