# @ultron-ai/local

Ultron-AI Local Sandbox Client - Execute commands on your local machine from Ultron-AI.

## Installation

```bash
npx @ultron-ai/local@latest --token YOUR_TOKEN
```

Or install globally:

```bash
npm install -g @ultron-ai/local
ultron-ai-local --token YOUR_TOKEN
```

## Usage

```bash
npx @ultron-ai/local@latest --token hsb_abc123
```

Commands run directly on your host OS. The client connects to Ultron-AI and relays commands in real-time.

## Options

| Option             | Description                                            |
| ------------------ | ------------------------------------------------------ |
| `--token TOKEN`    | Authentication token from Ultron-AI Settings (required) |
| `--name NAME`      | Optional connection name fallback (default: hostname)  |
| `--convex-url URL` | Override backend URL (for development)                 |
| `--help, -h`       | Show help message                                      |

## Getting Your Token

1. Go to [Ultron-AI Settings](https://ultron-a-i.vercel.app/settings)
2. Navigate to the "Agents" tab
3. Click "Generate Token" or copy your existing token

## Security

Commands run directly on your OS without any isolation. Only connect machines you trust and control. The client auto-terminates after 1 hour of inactivity.

## License

MIT
