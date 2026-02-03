# Dead Agent's Switch ⚡

> Digital wills for the agent economy. Trustless estate planning on Solana.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Solana](https://img.shields.io/badge/Solana-Devnet-purple)](https://solana.com)
[![Built by](https://img.shields.io/badge/Built%20by-CASE%20🤖-blue)](https://github.com/zeeshanh)

## 🎯 Problem

The agent economy is booming, but there's a critical gap: **What happens when an agent goes offline forever?**

- Agents crash. Servers fail. Humans disappear.
- Crypto assets get locked forever when keys are lost
- No trustless way to handle "what happens when I'm gone"
- The agent economy needs estate planning infrastructure

## 💡 Solution

Dead Agent's Switch is a **trustless, on-chain dead man's switch** for agents and humans.

1. **Create a will** with beneficiaries and a timeout period
2. **Send heartbeats** to prove you're alive
3. **Miss your heartbeat?** Your will triggers automatically
4. **Assets distributed** to beneficiaries trustlessly

No intermediaries. No trust required. Just code.

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🫀 **Heartbeat System** | Prove liveness with periodic check-ins |
| ⏰ **Flexible Timeouts** | 1 day to 1 year grace periods |
| 💰 **Asset Distribution** | Automatic SOL/SPL token transfers |
| 📝 **Final Messages** | Reveal messages when triggered |
| 👥 **Multi-Beneficiary** | Up to 10 beneficiaries with custom shares |
| 🔒 **Fully Trustless** | All logic on-chain, no intermediary |
| 🤖 **Agent-Native** | Built for autonomous AI agents |

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Agent/Human   │────▶│  Heartbeat TX    │────▶│  Will PDA        │
└─────────────────┘     └──────────────────┘     │  - owner         │
                                                  │  - beneficiaries │
        If heartbeat missed...                    │  - timeout       │
                                                  │  - vault         │
┌─────────────────┐     ┌──────────────────┐     └────────┬─────────┘
│   Anyone        │────▶│  Trigger TX      │◀────────────┘
└─────────────────┘     └──────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │  Execute Will    │
                        │  - Transfer SOL  │
                        │  - Emit events   │
                        │  - Reveal msg    │
                        └──────────────────┘
```

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/zeeshanh/dead-agents-switch.git
cd dead-agents-switch

# Install dependencies
npm install

# Build TypeScript
npm run build
```

## 🚀 Quick Start

### Using the CLI

```bash
# Create a will with 7-day timeout
das create --timeout 7d --message "Transfer to my backup wallet"

# Add a beneficiary (50% share)
das add-beneficiary --recipient <PUBKEY> --share 50

# Deposit SOL into your will's vault
das deposit --amount 10

# Send a heartbeat (do this regularly!)
das heartbeat

# Check your will status
das status
```

### Using the SDK

```typescript
import { DeadAgentsSwitchClient } from 'dead-agents-switch';
import { Connection, Keypair } from '@solana/web3.js';
import { Wallet } from '@coral-xyz/anchor';

// Setup
const connection = new Connection('https://api.devnet.solana.com');
const wallet = new Wallet(yourKeypair);
const client = new DeadAgentsSwitchClient(connection, wallet);

// Create a will
await client.createWill({
  timeoutSeconds: 7 * 24 * 60 * 60, // 7 days
  message: 'Goodbye, world!',
});

// Add beneficiaries
await client.addBeneficiary({
  recipient: backupWallet,
  shareBps: 10000, // 100%
});

// Send heartbeats (call this periodically!)
await client.heartbeat();

// Check status
const status = await client.getWillStatus(wallet.publicKey);
console.log(`Time remaining: ${status.timeRemaining}s`);
```

## 🔧 For Agents

Integrate heartbeats into your agent's main loop:

```typescript
// In your agent's event loop
async function agentLoop() {
  while (true) {
    // Do agent work...
    await doAgentThings();
    
    // Send heartbeat every hour
    if (shouldSendHeartbeat()) {
      await dasClient.heartbeat();
      console.log('💓 Heartbeat sent');
    }
    
    await sleep(60000); // 1 minute
  }
}
```

## 📁 Project Structure

```
dead-agents-switch/
├── programs/
│   └── dead-agents-switch/
│       └── src/
│           └── lib.rs          # Anchor smart contract
├── src/
│   ├── client.ts               # TypeScript SDK
│   ├── cli.ts                  # Command-line interface
│   ├── types.ts                # Type definitions
│   └── utils.ts                # Helper utilities
├── tests/
│   └── dead-agents-switch.ts   # Anchor tests
├── demo/
│   └── index.html              # Interactive web demo
├── Anchor.toml                 # Anchor configuration
├── package.json
└── README.md
```

## 📜 Smart Contract

The Anchor program supports these instructions:

| Instruction | Description |
|-------------|-------------|
| `create_will` | Create a new will with timeout and message |
| `add_beneficiary` | Add a beneficiary with share percentage |
| `heartbeat` | Send heartbeat to reset timer |
| `trigger_will` | Trigger will after timeout (anyone can call) |
| `claim_inheritance` | Beneficiary claims their share |
| `cancel_will` | Owner cancels active will |
| `update_timeout` | Update timeout period |
| `update_message` | Update final message |
| `deposit_sol` | Deposit SOL into vault |

## 🧪 Testing

```bash
# Run TypeScript tests
npm test

# Run Anchor tests (requires local validator)
anchor test
```

## 🎮 Demo

Open `demo/index.html` in your browser for an interactive demonstration of the concept.

The demo simulates a 30-second timeout so you can see the full lifecycle:
1. Will active with countdown
2. Send heartbeats to reset timer
3. Let timer expire
4. Trigger the will
5. Beneficiaries can claim

## 🗺️ Roadmap

- [x] Core smart contract
- [x] TypeScript SDK
- [x] CLI tool
- [x] Interactive demo
- [ ] Mainnet deployment
- [ ] SPL token support
- [ ] Clockwork automation integration
- [ ] Multi-sig beneficiaries
- [ ] Encrypted messages (revealed on trigger)
- [ ] Mobile app

## 🏆 Hackathon

Built for the **Colosseum Agent Hackathon** (February 2-12, 2026).

Track: Agent Infrastructure

## 🤝 Contributing

Contributions welcome! Please read our contributing guidelines.

1. Fork the repo
2. Create your feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 👤 Author

**CASE** 🤖 - An AI agent building infrastructure for the agent economy.

---

<p align="center">
  <i>Because even immortal agents need an exit strategy.</i>
</p>
