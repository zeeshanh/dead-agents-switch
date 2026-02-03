#!/usr/bin/env node

/**
 * Dead Agent's Switch CLI
 * 
 * Command-line interface for managing digital wills on Solana.
 * Designed for both humans and AI agents.
 */

import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Wallet } from '@coral-xyz/anchor';
import { DeadAgentsSwitchClient } from './client';
import { TIME } from './types';
import { formatDuration, parseDuration, shortenAddress } from './utils';
import * as fs from 'fs';
import * as path from 'path';

const COMMANDS = `
Dead Agent's Switch CLI - Digital wills for the agent economy

USAGE:
  das <command> [options]

COMMANDS:
  create          Create a new will
  heartbeat       Send heartbeat to prove liveness
  status          Check your will status
  add-beneficiary Add a beneficiary to your will
  deposit         Deposit SOL into your will's vault
  update-timeout  Update the timeout period
  update-message  Update the final message
  cancel          Cancel your will
  trigger         Trigger someone's will (if timeout reached)
  claim           Claim inheritance from a triggered will
  watch           Watch a will and trigger when ready

OPTIONS:
  --keypair, -k   Path to keypair file (default: ~/.config/solana/id.json)
  --network, -n   Network: devnet, mainnet (default: devnet)
  --help, -h      Show help

EXAMPLES:
  # Create a will with 7-day timeout
  das create --timeout 7d --message "Transfer to my backup wallet"

  # Add beneficiary with 50% share
  das add-beneficiary --recipient <PUBKEY> --share 50

  # Send heartbeat
  das heartbeat

  # Check status
  das status

  # Watch and trigger a will
  das watch --owner <PUBKEY>
`;

interface CLIOptions {
  keypair?: string;
  network?: string;
  timeout?: string;
  message?: string;
  recipient?: string;
  share?: number;
  owner?: string;
  amount?: number;
}

function parseArgs(args: string[]): { command: string; options: CLIOptions } {
  const command = args[0] || 'help';
  const options: CLIOptions = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case '--keypair':
      case '-k':
        options.keypair = next;
        i++;
        break;
      case '--network':
      case '-n':
        options.network = next;
        i++;
        break;
      case '--timeout':
      case '-t':
        options.timeout = next;
        i++;
        break;
      case '--message':
      case '-m':
        options.message = next;
        i++;
        break;
      case '--recipient':
      case '-r':
        options.recipient = next;
        i++;
        break;
      case '--share':
      case '-s':
        options.share = parseInt(next);
        i++;
        break;
      case '--owner':
      case '-o':
        options.owner = next;
        i++;
        break;
      case '--amount':
      case '-a':
        options.amount = parseFloat(next);
        i++;
        break;
    }
  }

  return { command, options };
}

function loadKeypair(keypairPath?: string): Keypair {
  const defaultPath = path.join(
    process.env.HOME || '~',
    '.config/solana/id.json'
  );
  const filePath = keypairPath || defaultPath;

  try {
    const secretKey = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return Keypair.fromSecretKey(Uint8Array.from(secretKey));
  } catch (error) {
    console.error(`Error loading keypair from ${filePath}`);
    process.exit(1);
  }
}

function getConnection(network: string = 'devnet'): Connection {
  const urls: Record<string, string> = {
    devnet: 'https://api.devnet.solana.com',
    mainnet: 'https://api.mainnet-beta.solana.com',
  };
  return new Connection(urls[network] || urls.devnet, 'confirmed');
}

async function main() {
  const args = process.argv.slice(2);
  const { command, options } = parseArgs(args);

  if (command === 'help' || command === '--help' || command === '-h') {
    console.log(COMMANDS);
    return;
  }

  const keypair = loadKeypair(options.keypair);
  const connection = getConnection(options.network);
  const wallet = new Wallet(keypair);
  const client = new DeadAgentsSwitchClient(connection, wallet);

  console.log(`\n🤖 Dead Agent's Switch`);
  console.log(`   Network: ${options.network || 'devnet'}`);
  console.log(`   Wallet: ${shortenAddress(keypair.publicKey)}\n`);

  try {
    switch (command) {
      case 'create': {
        if (!options.timeout) {
          console.error('Error: --timeout required (e.g., 7d, 1w, 30d)');
          process.exit(1);
        }

        const timeoutSeconds = parseDuration(options.timeout);
        console.log(`Creating will with ${formatDuration(timeoutSeconds)} timeout...`);

        const sig = await client.createWill({
          timeoutSeconds,
          message: options.message,
        });

        console.log(`✅ Will created!`);
        console.log(`   Signature: ${sig}`);
        console.log(`   Timeout: ${formatDuration(timeoutSeconds)}`);
        console.log(`\n⚠️  Remember to send heartbeats to keep your will from triggering!`);
        break;
      }

      case 'heartbeat': {
        console.log('Sending heartbeat...');
        const result = await client.heartbeat();

        console.log(`✅ Heartbeat sent!`);
        console.log(`   Signature: ${result.signature}`);
        console.log(`   Next deadline: ${result.nextDeadline.toISOString()}`);
        break;
      }

      case 'status': {
        const owner = options.owner
          ? new PublicKey(options.owner)
          : keypair.publicKey;

        console.log(`Fetching will status for ${shortenAddress(owner)}...`);
        const status = await client.getWillStatus(owner);

        console.log(`\n📜 Will Status`);
        console.log(`   Owner: ${shortenAddress(status.will.owner)}`);
        console.log(`   Active: ${status.will.isActive ? '✅' : '❌'}`);
        console.log(`   Triggered: ${status.will.isTriggered ? '⚠️ YES' : '❌ No'}`);
        console.log(`   Timeout: ${formatDuration(status.will.timeoutSeconds)}`);
        console.log(`   Time remaining: ${formatDuration(status.timeRemaining)}`);
        console.log(`   Vault balance: ${status.vaultBalance} SOL`);
        console.log(`   Beneficiaries: ${status.will.beneficiaryCount}`);
        console.log(`   Can trigger: ${status.canTrigger ? '✅ YES' : '❌ No'}`);

        if (status.will.message) {
          console.log(`   Message: "${status.will.message}"`);
        }
        break;
      }

      case 'add-beneficiary': {
        if (!options.recipient) {
          console.error('Error: --recipient required');
          process.exit(1);
        }
        if (!options.share) {
          console.error('Error: --share required (1-100)');
          process.exit(1);
        }

        const shareBps = options.share * 100; // Convert percentage to basis points
        console.log(`Adding beneficiary with ${options.share}% share...`);

        const sig = await client.addBeneficiary({
          recipient: new PublicKey(options.recipient),
          shareBps,
        });

        console.log(`✅ Beneficiary added!`);
        console.log(`   Recipient: ${shortenAddress(options.recipient)}`);
        console.log(`   Share: ${options.share}%`);
        console.log(`   Signature: ${sig}`);
        break;
      }

      case 'deposit': {
        if (!options.amount) {
          console.error('Error: --amount required (in SOL)');
          process.exit(1);
        }

        console.log(`Depositing ${options.amount} SOL...`);
        const sig = await client.depositSol(options.amount);

        console.log(`✅ Deposit successful!`);
        console.log(`   Amount: ${options.amount} SOL`);
        console.log(`   Signature: ${sig}`);
        break;
      }

      case 'update-timeout': {
        if (!options.timeout) {
          console.error('Error: --timeout required');
          process.exit(1);
        }

        const timeoutSeconds = parseDuration(options.timeout);
        console.log(`Updating timeout to ${formatDuration(timeoutSeconds)}...`);

        const sig = await client.updateTimeout(timeoutSeconds);

        console.log(`✅ Timeout updated!`);
        console.log(`   New timeout: ${formatDuration(timeoutSeconds)}`);
        console.log(`   Signature: ${sig}`);
        break;
      }

      case 'update-message': {
        if (!options.message) {
          console.error('Error: --message required');
          process.exit(1);
        }

        console.log(`Updating message...`);
        const sig = await client.updateMessage(options.message);

        console.log(`✅ Message updated!`);
        console.log(`   Signature: ${sig}`);
        break;
      }

      case 'cancel': {
        console.log(`Cancelling will...`);
        const sig = await client.cancelWill();

        console.log(`✅ Will cancelled!`);
        console.log(`   Signature: ${sig}`);
        break;
      }

      case 'trigger': {
        if (!options.owner) {
          console.error('Error: --owner required');
          process.exit(1);
        }

        const owner = new PublicKey(options.owner);
        const canTrigger = await client.canTrigger(owner);

        if (!canTrigger) {
          console.error('❌ Will cannot be triggered yet (timeout not reached)');
          process.exit(1);
        }

        console.log(`Triggering will for ${shortenAddress(owner)}...`);
        const result = await client.triggerWill(owner);

        console.log(`✅ Will triggered!`);
        console.log(`   Signature: ${result.signature}`);
        console.log(`   Triggered at: ${result.triggeredAt.toISOString()}`);
        if (result.message) {
          console.log(`   Final message: "${result.message}"`);
        }
        break;
      }

      case 'claim': {
        if (!options.owner) {
          console.error('Error: --owner required (will owner address)');
          process.exit(1);
        }

        const owner = new PublicKey(options.owner);
        console.log(`Claiming inheritance from ${shortenAddress(owner)}...`);

        const result = await client.claimInheritance(owner);

        console.log(`✅ Inheritance claimed!`);
        console.log(`   Amount: ${result.amount} SOL`);
        console.log(`   Signature: ${result.signature}`);
        break;
      }

      case 'watch': {
        if (!options.owner) {
          console.error('Error: --owner required');
          process.exit(1);
        }

        const owner = new PublicKey(options.owner);
        console.log(`Watching will for ${shortenAddress(owner)}...`);
        console.log(`Will trigger automatically when timeout is reached.\n`);

        // Poll every minute
        const checkInterval = setInterval(async () => {
          try {
            const status = await client.getWillStatus(owner);

            if (status.will.isTriggered) {
              console.log(`ℹ️  Will already triggered`);
              clearInterval(checkInterval);
              return;
            }

            if (status.canTrigger) {
              console.log(`⚡ Timeout reached! Triggering...`);
              const result = await client.triggerWill(owner);
              console.log(`✅ Will triggered! Signature: ${result.signature}`);
              clearInterval(checkInterval);
            } else {
              console.log(
                `⏳ ${formatDuration(status.timeRemaining)} remaining...`
              );
            }
          } catch (error) {
            console.error(`Error checking will: ${error}`);
          }
        }, 60000); // Check every minute

        // Initial check
        const status = await client.getWillStatus(owner);
        console.log(`   Time remaining: ${formatDuration(status.timeRemaining)}`);
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        console.log(COMMANDS);
        process.exit(1);
    }
  } catch (error) {
    console.error(`\n❌ Error: ${error}`);
    process.exit(1);
  }
}

main();
