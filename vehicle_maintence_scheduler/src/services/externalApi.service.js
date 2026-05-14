'use strict';

/**
 * External API service for the evaluation server.
 *
 * Auth flow:
 *   POST /evaluation-service/auth with { name, email, rollNo, accessCode, clientID, clientSecret }
 *   → returns { token_type: "Bearer", access_token: "<jwt>", expires_in: <unix_ts> }
 *
 * The JWT is then used as: Authorization: Bearer <access_token>
 * Token is cached in memory; auto-refreshed when expired.
 */

const axios = require('axios');

const BASE_URL = 'http://4.224.186.213/evaluation-service';

let _cachedToken = null;
let _tokenExpiry = 0;

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (_cachedToken && now < _tokenExpiry - 60) return _cachedToken; // 60s buffer

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

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function fetchDepots() {
  const token = await getAccessToken();
  const response = await axios.get(`${BASE_URL}/depots`, { headers: authHeaders(token) });
  return response.data.depots;
}

async function fetchVehicles() {
  const token = await getAccessToken();
  const response = await axios.get(`${BASE_URL}/vehicles`, { headers: authHeaders(token) });
  return response.data.vehicles;
}

module.exports = { fetchDepots, fetchVehicles, getAccessToken };
