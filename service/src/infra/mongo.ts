import { MongoClient, type Db } from "mongodb";
import { env } from "../config/env.js";

export type MongoContext = {
  client: MongoClient;
  db: Db;
};

export async function connectMongo(): Promise<MongoContext> {
  console.log("URI:", JSON.stringify(env.MONGODB_URI));

  const client = new MongoClient(env.MONGODB_URI);
  await client.connect();

  const db = client.db();

  await db
    .collection("jobs")
    .createIndexes([
      { key: { phase: 1, updatedAt: -1 } },
      { key: { outcome: 1, updatedAt: -1 } },
      { key: { updatedAt: -1 } },
    ]);
  await db
    .collection("events")
    .createIndexes([
      { key: { jobId: 1, seq: 1 }, unique: true },
      { key: { jobId: 1, createdAt: 1 } },
    ]);
  return { client, db };
}
