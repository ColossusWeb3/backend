# ColossusWeb3

[AI Agents that interact with blockchains, store data, send transactions, listen to events]

## Overview

Currently provides an API endpoint to interact with IPFS and Farcaster. It allows users to upload data to IPFS and post messages to Farcaster using simple HTTP requests.

## Prerequisites

- Install dependencies from package.json
- Local server running at `http://localhost:3000`

## API Usage

The API accepts POST requests with JSON payloads at `http://localhost:3000/api/agent`.

### 1. Upload Data to IPFS

Upload JSON data to IPFS using the following curl command:

```bash
curl -X POST -H "Content-Type: application/json" -d '{"query": "Upload this data to IPFS: {\"hello\": \"world\"}"}' http://localhost:3000/api/agent
```
### 2. Send Casts to Farcaster

Upload Post Casts on Farcaster using the following curl command:

```bash
curl -X POST -H "Content-Type: application/json" -d '{"query": "Post this to Farcaster: Hello from agent!"}' http://localhost:3000/api/agent

```

## Deployed URL

```bash
https://backend-b2mv.onrender.com
```bash