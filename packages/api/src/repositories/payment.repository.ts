import { Prisma, PrismaClient } from '@prisma/client';

export type PaymentTransactionClient = Prisma.TransactionClient;

export interface PaymentRecord {
  id: string;
  jobId: string;
  payerId: string;
  payeeId: string | null;
  amount: Prisma.Decimal;
  currency: string;
  status: string;
  escrowStatus: string | null;
  provider: string | null;
  providerRef: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePaymentInput {
  jobId: string;
  payerId: string;
  payeeId?: string | null;
  amount: Prisma.Decimal | number | string;
  currency?: string;
  status?: string;
  escrowStatus?: string | null;
  provider?: string | null;
  providerRef?: string | null;
  metadata?: Prisma.InputJsonValue | null;
}

export interface UpdatePaymentInput {
  payeeId?: string | null;
  amount?: Prisma.Decimal | number | string;
  currency?: string;
  status?: string;
  escrowStatus?: string | null;
  provider?: string | null;
  providerRef?: string | null;
  metadata?: Prisma.InputJsonValue | null;
}

export interface FindPaymentsFilter {
  jobId?: string;
  payerId?: string;
  payeeId?: string;
  status?: string;
  escrowStatus?: string;
  providerRef?: string;
}

export interface IPaymentRepository {
  create(
    input: CreatePaymentInput,
    tx?: PaymentTransactionClient,
  ): Promise<PaymentRecord>;

  findById(
    id: string,
    tx?: PaymentTransactionClient,
  ): Promise<PaymentRecord | null>;

  findByJobId(
    jobId: string,
    tx?: PaymentTransactionClient,
  ): Promise<PaymentRecord[]>;

  findByProviderRef(
    providerRef: string,
    tx?: PaymentTransactionClient,
  ): Promise<PaymentRecord | null>;

  findMany(
    filter: FindPaymentsFilter,
    tx?: PaymentTransactionClient,
  ): Promise<PaymentRecord[]>;

  update(
    id: string,
    input: UpdatePaymentInput,
    tx?: PaymentTransactionClient,
  ): Promise<PaymentRecord>;

  updateStatus(
    id: string,
    status: string,
    tx?: PaymentTransactionClient,
  ): Promise<PaymentRecord>;

  updateEscrowStatus(
    id: string,
    escrowStatus: string,
    tx?: PaymentTransactionClient,
  ): Promise<PaymentRecord>;

  delete(id: string, tx?: PaymentTransactionClient): Promise<PaymentRecord>;

  withTransaction<T>(
    fn: (tx: PaymentTransactionClient) => Promise<T>,
  ): Promise<T>;
}

type PaymentDelegate = {
  create(args: { data: Prisma.PaymentUncheckedCreateInput }): Promise<PaymentRecord>;
  findUnique(args: {
    where: Prisma.PaymentWhereUniqueInput;
  }): Promise<PaymentRecord | null>;
  findFirst(args: {
    where?: Prisma.PaymentWhereInput;
    orderBy?: Prisma.PaymentOrderByWithRelationInput;
  }): Promise<PaymentRecord | null>;
  findMany(args: {
    where?: Prisma.PaymentWhereInput;
    orderBy?: Prisma.PaymentOrderByWithRelationInput;
  }): Promise<PaymentRecord[]>;
  update(args: {
    where: Prisma.PaymentWhereUniqueInput;
    data: Prisma.PaymentUncheckedUpdateInput;
  }): Promise<PaymentRecord>;
  delete(args: {
    where: Prisma.PaymentWhereUniqueInput;
  }): Promise<PaymentRecord>;
};

type PrismaLikeClient = {
  payment: PaymentDelegate;
  $transaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T>;
};

function toDecimal(
  value: Prisma.Decimal | number | string,
): Prisma.Decimal {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

export class PaymentRepository implements IPaymentRepository {
  constructor(private readonly prisma: PrismaLikeClient) {}

  private getClient(tx?: PaymentTransactionClient): PaymentDelegate {
    return (tx ?? this.prisma).payment as unknown as PaymentDelegate;
  }

  async create(
    input: CreatePaymentInput,
    tx?: PaymentTransactionClient,
  ): Promise<PaymentRecord> {
    const data: Prisma.PaymentUncheckedCreateInput = {
      jobId: input.jobId,
      payerId: input.payerId,
      payeeId: input.payeeId ?? null,
      amount: toDecimal(input.amount),
      currency: input.currency ?? 'USD',
      status: input.status ?? 'PENDING',
      escrowStatus: input.escrowStatus ?? null,
      provider: input.provider ?? null,
      providerRef: input.providerRef ?? null,
      metadata: input.metadata ?? Prisma.JsonNull,
    };

    return this.getClient(tx).create({ data });
  }

  async findById(
    id: string,
    tx?: PaymentTransactionClient,
  ): Promise<PaymentRecord | null> {
    return this.getClient(tx).findUnique({ where: { id } });
  }

  async findByJobId(
    jobId: string,
    tx?: PaymentTransactionClient,
  ): Promise<PaymentRecord[]> {
    return this.getClient(tx).findMany({
      where: { jobId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findByProviderRef(
    providerRef: string,
    tx?: PaymentTransactionClient,
  ): Promise<PaymentRecord | null> {
    return this.getClient(tx).findFirst({
      where: { providerRef },
    });
  }

  async findMany(
    filter: FindPaymentsFilter,
    tx?: PaymentTransactionClient,
  ): Promise<PaymentRecord[]> {
    const where: Prisma.PaymentWhereInput = {};

    if (filter.jobId !== undefined) where.jobId = filter.jobId;
    if (filter.payerId !== undefined) where.payerId = filter.payerId;
    if (filter.payeeId !== undefined) where.payeeId = filter.payeeId;
    if (filter.status !== undefined) where.status = filter.status;
    if (filter.escrowStatus !== undefined) {
      where.escrowStatus = filter.escrowStatus;
    }
    if (filter.providerRef !== undefined) {
      where.providerRef = filter.providerRef;
    }

    return this.getClient(tx).findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(
    id: string,
    input: UpdatePaymentInput,
    tx?: PaymentTransactionClient,
  ): Promise<PaymentRecord> {
    const data: Prisma.PaymentUncheckedUpdateInput = {};

    if (input.payeeId !== undefined) data.payeeId = input.payeeId;
    if (input.amount !== undefined) data.amount = toDecimal(input.amount);
    if (input.currency !== undefined) data.currency = input.currency;
    if (input.status !== undefined) data.status = input.status;
    if (input.escrowStatus !== undefined) {
      data.escrowStatus = input.escrowStatus;
    }
    if (input.provider !== undefined) data.provider = input.provider;
    if (input.providerRef !== undefined) data.providerRef = input.providerRef;
    if (input.metadata !== undefined) {
      data.metadata = input.metadata ?? Prisma.JsonNull;
    }

    return this.getClient(tx).update({ where: { id }, data });
  }

  async updateStatus(
    id: string,
    status: string,
    tx?: PaymentTransactionClient,
  ): Promise<PaymentRecord> {
    return this.getClient(tx).update({
      where: { id },
      data: { status },
    });
  }

  async updateEscrowStatus(
    id: string,
    escrowStatus: string,
    tx?: PaymentTransactionClient,
  ): Promise<PaymentRecord> {
    return this.getClient(tx).update({
      where: { id },
      data: { escrowStatus },
    });
  }

  async delete(
    id: string,
    tx?: PaymentTransactionClient,
  ): Promise<PaymentRecord> {
    return this.getClient(tx).delete({ where: { id } });
  }

  async withTransaction<T>(
    fn: (tx: PaymentTransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(fn);
  }
}

export function createPaymentRepository(
  prisma: PrismaClient | PrismaLikeClient,
): PaymentRepository {
  return new PaymentRepository(prisma as unknown as PrismaLikeClient);
}

export default PaymentRepository;