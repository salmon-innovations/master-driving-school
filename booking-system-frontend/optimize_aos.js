import fs from 'fs';

let c = fs.readFileSync('src/App.jsx', 'utf8');

// Update AOS settings
const oldAos = `  useEffect(() => {
    AOS.init({
      duration: 600,
      once: false,
      offset: 50,
      easing: 'ease-out',
      mirror: true,
      anchorPlacement: 'top-bottom'
    })
  }, [])`;

const newAos = `  useEffect(() => {
    AOS.init({
      duration: 400,
      once: true,
      offset: 50,
      easing: 'ease-out-cubic',
      mirror: false,
      anchorPlacement: 'top-bottom'
    })
  }, [])`;

if (c.includes('AOS.init')) {
    c = c.replace(/duration: 600/g, 'duration: 400');
    c = c.replace(/once: false/g, 'once: true');
    c = c.replace(/easing: 'ease-out'/g, "easing: 'ease-out-cubic'");
    c = c.replace(/mirror: true/g, 'mirror: false');
}

fs.writeFileSync('src/App.jsx', c);
console.log("Improved AOS settings in App.jsx");
