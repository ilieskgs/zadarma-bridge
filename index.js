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

async function zadarmaRequest(method, params) {
  const keys = Object.keys(params).sort();
  const paramsStr = keys.map(function(k) { return k + '=' + encodeURIComponent(params[k]).replace(/%20/g, '+'); }).join('&');
  const sign = crypto.createHmac('sha1', ZADARMA_SECRET).update(method + paramsStr + crypto.createHash('md5').update(paramsStr).digest('hex')).digest('base64');
  const header = ZADARMA_KEY + ':' + sign;
  return axios.post('https://api.zadarma.com' + method, params, {
    headers: { Authorization: header, 'Content-Type': 'application/x-www-form-urlencoded' }
  });
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

async function zadarmaRequest(method, params) {
  const keys = Object.keys(params).sort();
  const paramsStr = keys.map(function(k) { return k + '=' + encodeURIComponent(params[k]).replace(/%20/g, '+'); }).join('&');
  const md5params = crypto.createHash('md5').update(paramsStr).digest('hex');
  const sign = crypto.createHmac('sha1', ZADARMA_SECRET).update(method + paramsStr + md5params).digest('base64');
  const header = ZADARMA_KEY + ':' + sign;
  return axios.post('https://api.zadarma.com' + method, paramsStr, {
    headers: { Authorization: header, 'Content-Type': 'application/x-www-form-urlencoded' }
  });
}

async function sendSMS(to, message) {
  await zadarmaRequest('/v1/sms/send/', { number: to, message: message });
}

async function askGPT(phone, userMessage) {
  if (!conversations[phone]) {
    conversations[phone] = [
      { role: 'system', content: 'Tu es un assistant virtuel professionnel pour une entreprise locale. Tu reponds aux SMS des clients de facon courte, polie et utile. Tu peux prendre des rendez-vous et repondre aux questions courantes.' }
    ];
  }
  conversations[phone].push({ role: 'user', content: userMessage });
  const response = await axios.post('https://api.openai.com/v1/chat/completions', {
    model: 'gpt-4o-mini',
    messages: conversations[phone],
    max_tokens: 150
  }, {
    headers: { Authorization: 'Bearer ' + OPENAI_API_KEY }
  });
  const reply = response.data.choices[0].message.content;
  conversations[phone].push({ role: 'assistant', content: reply });
  return reply;
}

app.all('/', async (req, res) => {
  const data = Object.assign({}, req.query, req.body);
  console.log('Recu:', data.event, data.disposition);

  if (data.zd_echo) return res.send(data.zd_echo);

  if (data.event === 'NOTIFY_END' && data.disposition === 'cancel') {
    try {
      await axios.post(MAKE_URL, data);
      console.log('SMS appel manque declenche !');
    } catch(e) {
      console.log('Erreur Make:', e.message);
    }
  }

  if (data.event === 'NOTIFY_SMS' || data.event === 'SMS') {
    try {
      const phone = data.caller_id;
      const message = data.msg;
      console.log('SMS entrant de ' + phone + ': ' + message);
      const reply = await askGPT(phone, message);
      console.log('Reponse GPT: ' + reply);
      await sendSMS(phone, reply);
      console.log('SMS reponse envoye !');
    } catch(e) {
      console.log('Erreur SMS IA:', e.message);
    }
  }

  res.send('OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, function() {
  console.log('Serveur demarre sur port ' + PORT);
  zadarmaRequest('/v1/pbx/webhooks/url/', { url: 'https://zadarma-bridge-production.up.railway.app' })
    .then(function(r) { console.log('Webhook SMS enregistre:', r.data); })
    .catch(function(e) { console.log('Erreur webhook:', e.message); });
});;