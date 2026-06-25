import type { Response } from "express";
import type { AutomationEvent } from "@itr/shared";
import { RingBuffer } from "./ring-buffer.js";

type Client = {
  jobId: string;
  response: Response;
};

export class EventBus {
  private clients = new Set<Client>();
  private buffers = new Map<string, RingBuffer<AutomationEvent>>();

  constructor(private readonly bufferSize = 500) {}

  addClient(jobId: string, response: Response): () => void {
    const client = { jobId, response };
    this.clients.add(client);
    return () => this.clients.delete(client);
  }

  publish(event: AutomationEvent) {
    let buffer = this.buffers.get(event.jobId);
    if (!buffer) {
      buffer = new RingBuffer<AutomationEvent>(this.bufferSize);
      this.buffers.set(event.jobId, buffer);
    }
    buffer.push(event);

    for (const client of this.clients) {
      if (client.jobId === event.jobId) {
        writeSse(client.response, event);
      }
    }
  }

  closeAll() {
    for (const client of this.clients) client.response.end();
    this.clients.clear();
  }
}

export function writeSse(response: Response, event: AutomationEvent) {
  response.write(`id: ${event.seq ?? ""}\n`);
  response.write("event: automation-event\n");
  response.write(`data: ${JSON.stringify(event)}\n\n`);
}
