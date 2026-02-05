import * as sdk from 'matrix-js-sdk';
import dotenv from 'dotenv';

dotenv.config();

const MATRIX_HOMESERVER_URL = process.env.MATRIX_HOMESERVER_URL || 'http://localhost:8008';
const MATRIX_BOT_USER_ID = process.env.MATRIX_BOT_USER_ID;
const MATRIX_BOT_ACCESS_TOKEN = process.env.MATRIX_BOT_ACCESS_TOKEN;

console.log('Config:', {
  homeserver: MATRIX_HOMESERVER_URL,
  userId: MATRIX_BOT_USER_ID,
  token: MATRIX_BOT_ACCESS_TOKEN ? '***' : 'NOT SET'
});

const client = sdk.createClient({
  baseUrl: MATRIX_HOMESERVER_URL,
  userId: MATRIX_BOT_USER_ID,
  accessToken: MATRIX_BOT_ACCESS_TOKEN,
});

try {
  const whoami = await client.whoami();
  console.log('✅ Matrix client connected:', whoami);
} catch (error) {
  console.error('❌ Failed to connect:', error.message);
}
