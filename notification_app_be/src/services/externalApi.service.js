'use strict';

const axios = require('axios');

const BASE_URL = 'http://4.224.186.213/evaluation-service';

let _cachedToken = null;
let _tokenExpiry = 0;

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (_cachedToken && now < _tokenExpiry - 60) return _cachedToken;

  const response = await axios.post(`${BASE_URL}/auth`, {
    name:         process.env.REG_NAME,
    email:        process.env.REG_EMAIL,
    rollNo:       process.env.ROLL_NO,
    accessCode:   process.env.ACCESS_CODE,
    clientID:     process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
  });

  _cachedToken = response.data.access_token;
  _tokenExpiry = response.data.expires_in;
  return _cachedToken;
}

async function fetchNotifications() {
  const token = await getAccessToken();
  const response = await axios.get(`${BASE_URL}/notifications`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  return response.data.notifications || response.data;
}

module.exports = { fetchNotifications, getAccessToken };
