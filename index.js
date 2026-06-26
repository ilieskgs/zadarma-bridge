const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const MAKE_URL = 'https://hook.eu2.make.com/srvppkgm0uezqykuwp6tbxrthw3t39u4';
const ZADARMA_KEY = process.env.ZADARMA_KEY;
const ZADARMA_SECRET = process.env.ZADARMA_SECRET;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const conversations = {};

async function sendSMS(to, message) {
  const params = { number: to, message: message };
  const sortedParams = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
  const sign = crypto.createHmac('md5', ZADARMA_SECRET).update('/v1/sms/send/' + sortedParams).digest('hex');
  const encoded = Buffer.from(`${ZADARMA_KEY}:${sign}`).toString('base64');
  await axios.post('https://api.zadarma.com/v1/sms/send/', params, {
    headers: { Authorization: `Basic ${encoded}` }
  });
}

async function askGPT(phone, userMessage) {
  if (!conversations[phone]) {
    conversations[phone] = [
      { role: 'system', content: `Tu es un assistant virtuel professionnel pour une entreprise locale. 
Tu réponds aux SMS des clients de façon courte, polie et utile. 
Tu peux prendre des rendez-vous, répondre aux questions courantes. 
Si le client veut un RDV, demande-lui sa disponibilité (jour et heure).` }
    ];
  }
  conversations[phone].push({ role: 'user', content: userMessage });
  const response = await axios.post('https://api.openai.com/v1/chat/completions', {
    model: 'gpt-4o-mini',
    messages: conversations[phone],
    max_tokens: 150
  }, {
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` }
  });
  const reply = response.data.choices[0].message.content;
  conversations[phone].push({ role: 'assistant', content: reply });
  return reply;
}

app.all('/', async (req, res) => {
  const data = { ...req.query, ...req.body };
  console.log('Recu:', data.event, data.disposition);

  if (data.zd_echo) return res.send(data.zd_echo);

  if (data.event === 'NOTIFY_END' && data.disposition === 'cancel') {
    try {
      await axios.post(MAKE_URL, data);
      console.log('SMS missed call declenche !');
    } catch(e) {
      console.log('Erreur Make:', e.message);
    }
  }

  if (data.event === 'NOTIFY_SMS') {
    try {
      const phone = data.caller_id;
      const message = data.msg;
      console.log(`SMS entrant de ${phone}: ${message}`);
      const reply = await askGPT(phone, message);
      console.log(`Reponse GPT: ${reply}`);
      await sendSMS(phone, reply);
      console.log('SMS reponse envoye !');
    } catch(e) {
      console.log('Erreur SMS IA:', e.message);
    }
  }

  res.send('OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur demarre sur port ${PORT}`));s