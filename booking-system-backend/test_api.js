const { getAllUsers } = require('./controllers/adminController');

const req = { query: { limit: 5 } };
const res = {
    json: function (data) {
        console.log(JSON.stringify(data.users.map(u => ({ id: u.id, name: u.first_name, branch: u.branch_name })), null, 2));
    },
    status: function (code) { return this; }
};

getAllUsers(req, res);
