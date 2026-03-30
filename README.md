# Gemini CLI OpenClaw Bridge

A local Gemini CLI bridge that exposes your Gemini CLI as an OpenAI-compatible REST API for OpenClaw and other agent frameworks.

This project is designed for developers who want a targeted OpenClaw integration without relying on Google OAuth or third-party authorization.
It enables rapid local app development, testing, and integration with OpenClaw or any other OpenAI-compatible agent framework.

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

## Environment

Copy the example env file and set your JWT secret:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Then edit `.env` and set a strong `JWT_SECRET`.

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

Generate a token for your client and keep it in an environment variable:

```bash
export OPENCLAW_JWT_TOKEN=$(npm run token)
```

Then configure OpenClaw with that token. If the config requires a literal value, paste the generated token into `apiKey`.

```json
"apiKey": "YOUR_JWT_TOKEN"
```

For direct API testing, use the token in the `Authorization` header:

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENCLAW_JWT_TOKEN" \
  -d '{"messages":[{"role":"user","content":"Write a one-sentence greeting."}]}'
```

If OpenClaw supports environment interpolation in its config, use:

```json
"apiKey": "$OPENCLAW_JWT_TOKEN"
```

Otherwise, keep the token value only in your terminal environment and avoid hardcoding it in shared files.
