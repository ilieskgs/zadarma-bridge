const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const MAKE_URL = 'https://hook.eu2.make.com/srvppkgm0uezqykuwp6tbxrthw3t39u4';

app.all('/', async (req, res) => {
  const data = { ...req.query, ...req.body };
  console.log('Recu:', data.event, data.disposition);

  if (data.zd_echo) {
    return res.send(data.zd_echo);
  }

  if (data.event === 'NOTIFY_END') {
    try {
      await axios.post(MAKE_URL, data);
      console.log('SMS declenche !');
    } catch(e) {
      console.log('Erreur:', e.message);
    }
  }

  res.send('OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur demarre sur port ${PORT}`));
