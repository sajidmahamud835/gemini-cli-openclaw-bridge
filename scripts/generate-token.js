const jwt = require('jsonwebtoken');

const secret = process.env.JWT_SECRET;
if (!secret) {
  console.error('Missing JWT_SECRET environment variable.');
  process.exit(1);
}

const token = jwt.sign(
  {
    sub: 'gemini-bridge',
    iat: Math.floor(Date.now() / 1000),
  },
  secret,
  {
    algorithm: 'HS256',
    expiresIn: '30d',
  }
);

console.log(token);
