import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, JobsOptions } from 'bullmq';

@Injectable()
export class QueueService {
    private readonly logger = new Logger(QueueService.name);
    private readonly queues = new Map<string, Queue>();

    constructor(
        @InjectQueue('notification') notificationQueue: Queue,
        @InjectQueue('invoice') invoiceQueue: Queue,
        @InjectQueue('ai') aiQueue: Queue,
        @InjectQueue('payment-reminder') paymentReminderQueue: Queue,
        @InjectQueue('report') reportQueue: Queue,
        @InjectQueue('sync') syncQueue: Queue,
    ) {
        this.queues.set('notification', notificationQueue);
        this.queues.set('invoice', invoiceQueue);
        this.queues.set('ai', aiQueue);
        this.queues.set('payment-reminder', paymentReminderQueue);
        this.queues.set('report', reportQueue);
        this.queues.set('sync', syncQueue);
    }

    async addToQueue(
        queueName: string,
        jobName: string,
        data: Record<string, unknown>,
        options?: JobsOptions,
    ) {
        const queue = this.queues.get(queueName);
        if (!queue) {
            this.logger.error(`Queue "${queueName}" not found`);
            throw new Error(`Queue "${queueName}" not found`);
        }

        const job = await queue.add(jobName, data, options);
        this.logger.log(`[${queueName}] Job "${jobName}" added — id: ${job.id}`);
        return job;
    }

    getQueue(name: string): Queue | undefined {
        return this.queues.get(name);
    }

    getAllQueues(): Map<string, Queue> {
        return this.queues;
    }
}
