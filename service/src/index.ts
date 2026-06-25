import { createServer } from "node:http";
import { EventBus } from "./domain/event-bus.js";
import { createApp } from "./http/app.js";
import { env } from "./config/env.js";
import { connectMongo } from "./infra/mongo.js";
import { JobRepository } from "./infra/repositories.js";
import { logger } from "./infra/logger.js";

const mongo = await connectMongo();
const repo = new JobRepository(mongo.db);
const bus = new EventBus();
const server = createServer(createApp(repo, bus));

server.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "service listening");
});

async function shutdown(signal: string) {
  logger.info({ signal }, "shutting down");
  bus.closeAll();
  server.close(async () => {
    await mongo.client.close();
    process.exit(0);
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
