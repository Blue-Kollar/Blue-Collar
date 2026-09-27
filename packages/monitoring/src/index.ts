import * as dotenv from 'dotenv';
import ContractMonitor from './monitor';
import { TESTNET_SOROBAN_RPC_URL } from '@bluecollar/sdk';

dotenv.config();

const config = {
  rpcUrl: process.env.STELLAR_RPC_URL || TESTNET_SOROBAN_RPC_URL,
  registryContractId: process.env.REGISTRY_CONTRACT_ID || '',
  marketContractId: process.env.MARKET_CONTRACT_ID || '',
  alertWebhook: process.env.ALERT_WEBHOOK_URL,
};

const monitor = new ContractMonitor(config);

monitor.start().catch(console.error);
monitor.monitorBalanceChanges();

process.on('SIGINT', () => {
  console.log('Shutting down monitor...');
  process.exit(0);
});
