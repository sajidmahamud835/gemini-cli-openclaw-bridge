# Gemini CLI OpenClaw Bridge

A lightweight local bridge that makes the Gemini CLI available through an OpenAI-compatible REST API.

This project solves a common problem for developers who want to connect Gemini to OpenClaw or other AI agent frameworks without relying on Google OAuth or third-party authorization flows.

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
        "apiKey": "dummy-key-not-needed",
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
