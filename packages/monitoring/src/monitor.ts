import { Server } from '@stellar/stellar-sdk';

interface MonitorConfig {
  rpcUrl: string;
  registryContractId: string;
  marketContractId: string;
  alertWebhook?: string;
}

interface ContractEvent {
  type: string;
  contractId: string;
  ledger: number;
  timestamp: Date;
  data: any;
}

class ContractMonitor {
  private server: Server;
  private config: MonitorConfig;
  private lastProcessedLedger: number = 0;

  constructor(config: MonitorConfig) {
    this.config = config;
    this.server = new Server(config.rpcUrl);
  }

  async start() {
    console.log('Starting contract monitor...');
    await this.monitorEvents();
  }

  private async monitorEvents() {
    const eventStream = this.server
      .events()
      .cursor('now')
      .stream({
        onmessage: (event: any) => this.handleEvent(event),
        onerror: (error: any) => this.handleError(error),
      });
  }

  private async handleEvent(event: any) {
    const contractEvent: ContractEvent = {
      type: event.type,
      contractId: event.contract_id,
      ledger: event.ledger,
      timestamp: new Date(event.created_at),
      data: event,
    };

    console.log(`Event detected: ${contractEvent.type} at ledger ${contractEvent.ledger}`);

    if (this.isCriticalEvent(contractEvent)) {
      await this.sendAlert(contractEvent);
    }

    await this.trackMetrics(contractEvent);
  }

  private isCriticalEvent(event: ContractEvent): boolean {
    const criticalEvents = ['EscCrt', 'ArbReq', 'ArbRes', 'WrkReg'];
    return criticalEvents.includes(event.type);
  }

  private async sendAlert(event: ContractEvent) {
    if (!this.config.alertWebhook) return;

    const alert = {
      title: `Critical Event: ${event.type}`,
      message: `Contract ${event.contractId} emitted ${event.type} at ledger ${event.ledger}`,
      timestamp: event.timestamp,
      data: event.data,
    };

    console.log('ALERT:', JSON.stringify(alert, null, 2));
  }

  private async trackMetrics(event: ContractEvent) {
    console.log(`Tracking metrics for event: ${event.type}`);
  }

  private handleError(error: any) {
    console.error('Event stream error:', error);
  }

  async getContractBalance(contractId: string): Promise<string> {
    try {
      const account = await this.server.loadAccount(contractId);
      return account.balances[0]?.balance || '0';
    } catch (error) {
      console.error('Error fetching balance:', error);
      return '0';
    }
  }

  async monitorBalanceChanges() {
    setInterval(async () => {
      const registryBalance = await this.getContractBalance(this.config.registryContractId);
      const marketBalance = await this.getContractBalance(this.config.marketContractId);

      console.log(`Registry balance: ${registryBalance} XLM`);
      console.log(`Market balance: ${marketBalance} XLM`);
    }, 60000);
  }
}

export default ContractMonitor;
