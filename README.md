# Gemini Pro Local Bridge

A local Gemini Pro-style bridge that exposes your Gemini CLI as an OpenAI-compatible REST API.

This project is designed for developers who want a free, local alternative to Google AI Studio limits and OAuth-based APIs.
It enables rapid local app development, testing, and integration with OpenClaw or any other OpenAI-compatible agent framework without relying on third-party authorization.

## Why use this bridge?

- Use your local Gemini CLI as a private Gemini Pro-style API for building and testing apps.
- Avoid platform rate limits and OAuth-based access controls from Google AI Studio and other hosted services.
- Enable rapid prototyping for OpenClaw, coding agents, bots, code assistants, and other developer tooling.
- Keep the API endpoint internal and secure with JWT-based access tokens.
- Build local apps with a high-capacity Gemini runtime without sharing credentials or relying on external APIs.

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
