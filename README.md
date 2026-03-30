# Gemini CLI OpenClaw Bridge

A lightweight local bridge that makes the Gemini CLI available through an OpenAI-compatible REST API.

This project solves a common problem for developers who want to connect Gemini to OpenClaw or other AI agent frameworks without relying on Google OAuth or third-party authorization flows.
It is especially useful for developers who want a local, high-capacity Gemini-like experience without hosting limits or shared platform quotas from services like Google AI Studio.

## Why use this bridge?

- Use your local Gemini CLI as a private agent endpoint for building and testing apps.
- Avoid platform rate limits and OAuth-based access controls when you own the local runtime.
- Enable rapid prototyping for OpenClaw, bots, code assistants, and other developer tooling.
- Keep the API endpoint internal and secure with JWT-based access tokens.

## Features

- Exposes `POST /v1/chat/completions`
- Accepts standard OpenAI-style `messages`
- Runs the local `gemini` CLI securely
- Returns responses in OpenAI JSON format
- Works with OpenClaw's custom provider configuration

## Install

```bash
npm install
```

## Run

```bash
npm start
```

## Test

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Write a one-sentence greeting."}]}'
```

## OpenClaw Configuration

Add a custom provider in `~/.openclaw/openclaw.json`:

```json
{
  "models": {
    "mode": "merge",
    "providers": {
      "cli-bridge": {
        "baseUrl": "http://localhost:3000/v1",
        "apiKey": "YOUR_JWT_TOKEN",
        "api": "openai-completions",
        "models": [
          {
            "id": "gemini-local",
            "name": "Gemini CLI Wrapper",
            "reasoning": false,
            "input": ["text"]
          }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "models": {
        "cli-bridge/gemini-local": {
          "alias": "local-gemini"
        }
      }
    }
  }
}
```

Then apply the config:

```bash
openclaw gateway config.apply --file ~/.openclaw/openclaw.json
```

And switch models:

```text
/model local-gemini
```

## JWT API Token

This bridge protects the endpoint with a JSON Web Token (JWT).

Set the secret before running the server:

```bash
export JWT_SECRET="your-strong-secret"
npm start
```

Generate a token for your client:

```bash
node -e "const jwt=require('jsonwebtoken'); console.log(jwt.sign({sub:'gemini-bridge'}, process.env.JWT_SECRET, {algorithm:'HS256', expiresIn:'30d'}));"
```

Then use that token as the `apiKey` in OpenClaw or on requests directly in an `Authorization` header:

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"messages":[{"role":"user","content":"Write a one-sentence greeting."}]}'
```
