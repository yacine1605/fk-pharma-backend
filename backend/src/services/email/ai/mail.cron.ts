import cron from "node-cron";
import { mailFetchQueue } from "./queues";

const CRON_SCHEDULE = "*/2 * * * *";

export function startMailCron() {
  void mailFetchQueue.add(
    "fetch-unseen-emails",
    {},
    {
      jobId: "fetch-unseen-emails",
      removeOnComplete: 100,
      removeOnFail: 200,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 10_000,
      },
    },
  );

  cron.schedule(CRON_SCHEDULE, () => {
    void mailFetchQueue.add(
      "fetch-unseen-emails",
      {},
      {
        jobId: `fetch-unseen-emails-${Date.now()}`,
        removeOnComplete: 100,
        removeOnFail: 200,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 10_000,
        },
      },
    );
  });
}
