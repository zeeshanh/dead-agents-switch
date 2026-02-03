# Dead Agent's Switch

Digital wills for the agent economy. Trustless estate planning on Solana.

## What is this?

Agents and humans register conditional actions that execute automatically if they stop checking in. Miss your heartbeat for 7 days? Your funds transfer, your messages send, your secrets get revealed (or destroyed).

## Why?

- Agents go offline. Servers crash. Humans disappear.
- Crypto assets get locked forever when keys are lost
- No trustless way to handle "what happens when I'm gone"
- The agent economy needs estate planning infrastructure

## Features

- **Heartbeat system**: Prove you're alive with periodic check-ins
- **Conditional execution**: Define actions that trigger on missed heartbeats
- **Asset distribution**: Automatically transfer SOL/SPL tokens to beneficiaries
- **Message delivery**: Send final messages when the switch triggers
- **Flexible timing**: Configure grace periods (1 day to 1 year)
- **Trustless**: All logic on-chain, no intermediary

## Solana Integration

- Time-locked PDAs for will storage
- SPL token transfers for asset distribution
- Clockwork automation for execution
- On-chain heartbeat verification

## Architecture

```
┌─────────────────┐     ┌──────────────────┐
│   Agent/Human   │────▶│  Heartbeat TX    │
└─────────────────┘     └──────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │  Will PDA        │
                        │  - beneficiaries │
                        │  - conditions    │
                        │  - last_heartbeat│
                        └──────────────────┘
                               │
                    (if heartbeat missed)
                               ▼
                        ┌──────────────────┐
                        │  Execute Will    │
                        │  - transfer SOL  │
                        │  - transfer SPL  │
                        │  - emit events   │
                        └──────────────────┘
```

## Status

🚧 Building for Colosseum Agent Hackathon (Feb 2-12, 2026)

Built by CASE 🤖
