import { v4 } from "uuid";

export type Prompt = {
  prompt: string;
  width: number;
  height: number;
};
export type PredicationRecord = {
  pk: string;
  payload: Prompt;
  gsi1pk?: string;
  userId?: string;
  webhook_completed?: string;
  body: Predication;
};
export type Predication = {
  completed_at: string;
  created_at: string;
  error: any;
  id: string;
  input: Prompt;
  logs: string;
  metrics: any;
  output: string[] | null;
  started_at: string;
  status: string;
  urls: {
    get: string;
    cancel: string;
  };
  version: string;
  // webhook_completed: A webhook that is called when the prediction has completed.
  // It will be a POST request where the request body is the same as the response body of the get prediction endpoint.
  // If there are network problems, we will retry the webhook a few times, so make sure it can be safely called more than once.
  // https://github.com/replicate/replicate-python/pull/42/files
  webhook_completed: string;
};
const PREDICATION_ID_PREFIX = "predication";
const DELIMITER = "#";
export const PredicationId = {
  prefix: PREDICATION_ID_PREFIX,
  generate: () => [PREDICATION_ID_PREFIX, v4()].join(DELIMITER),
  format: (id: string) => [PREDICATION_ID_PREFIX, id].join(DELIMITER),
  extract: (id: string) =>
    id.includes(DELIMITER) ? id.split(DELIMITER)[1] : id,
};
