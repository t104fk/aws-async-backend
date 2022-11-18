export const QUEUE_URL = process.env.QUEUE_URL!;
const TTL_IN_SECONDS = 60;
export const MESSAGE_GROUP = "ASYNC_FIFO";

export function getExpirationTime() {
  return Math.floor(Date.now() / 1000) + TTL_IN_SECONDS;
}
