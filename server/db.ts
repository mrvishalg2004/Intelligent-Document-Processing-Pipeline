import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("MONGODB_URI is not set in the environment variables.");
}

const client = new MongoClient(uri);
export const clientPromise = client.connect();
export const db = client.db();

export async function connectToDatabase() {
  try {
    await clientPromise;
    console.log("Connected successfully to MongoDB");
  } catch (e) {
    console.error("Could not connect to MongoDB", e);
    process.exit(1);
  }
}
