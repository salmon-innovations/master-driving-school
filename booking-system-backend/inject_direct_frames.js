const pool = require('./config/db');

async function run() {
    const updates = [
        { name: 'Antipolo', url: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3861.326823337106!2d121.1749298!3d14.5804437!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3397c1dd753ab849%3A0x652ad64a2b765e7d!2sPuregold%20Circumferential!5e0!3m2!1sen!2sph!4v1772004472595!5m2!1sen!2sph' },
        { name: 'Bocaue', url: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3857.8438107118795!2d120.93741560000001!3d14.777826099999995!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3397b2814a845501%3A0x8a4329f56d1f6480!2sPRIME%20MASTER%20DRIVING%20SCHOOL!5e0!3m2!1sen!2sph!4v1772004497779!5m2!1sen!2sph' },
        { name: 'Mandaluyong', url: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3861.425232047237!2d121.04276650000001!3d14.574828899999996!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3397c84ed3d8341b%3A0xe21eb6794a360eba!2s373%20Boni%20Ave%2C%20Mandaluyong%20City%2C%201550%20Metro%20Manila!5e0!3m2!1sen!2sph!4v1772004515166!5m2!1sen!2sph' },
        { name: 'Bacoor', url: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3863.7941031110727!2d120.9500185!3d14.439026199999995!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3397d3365e915fdf%3A0xeb216ec77b5fbd93!2sStronghold%20Insurance%20Cavite%20Business%20Center!5e0!3m2!1sen!2sph!4v1772004658906!5m2!1sen!2sph' },
        { name: 'Meycauayan', url: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3858.0335202438187!2d120.99048870000001!3d14.7671417!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3397b3a047580261%3A0x6846d43e8ceefe2a!2sMaster%20Driving%20School%20-%20Meycauayan!5e0!3m2!1sen!2sph!4v1772004679720!5m2!1sen!2sph' },
        { name: 'Biñan', url: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3865.662338306186!2d121.08618690000002!3d14.3310358!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3397d9e6bc9db379%3A0x4dc1226469e8e15d!2sMASTER%20DRIVING%20SCHOOL!5e0!3m2!1sen!2sph!4v1772004699562!5m2!1sen!2sph' }
    ];

    for (const target of updates) {
        await pool.query('UPDATE branches SET embed_url = $1 WHERE name ILIKE $2', [target.url, '%' + target.name + '%']);
        console.log(`Updated ${target.name}`);
    }
    process.exit();
}
run();
