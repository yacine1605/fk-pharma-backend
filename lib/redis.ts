import IORedis from "ioredis";

export const redis = new IORedis({
  host: "192.168.1.8", // home machine running Docker
  port: 6379,
  maxRetriesPerRequest: null,
});
