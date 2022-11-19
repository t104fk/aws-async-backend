import { v4 } from "uuid";

export type Prompt = {
  prompt: string;
  width: number;
  height: number;
};
export type PromptRecord = {
  id: string;
  payload: Prompt;
  gsi1pk?: string;
  userId?: string;
  webhook_completed?: string;
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
  status: "starting";
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
const PROMPT_ID_PREFIX = "prompt";
const DELIMITER = "#";
export const PromptId = {
  prefix: PROMPT_ID_PREFIX,
  generate: () => [PROMPT_ID_PREFIX, v4()].join(DELIMITER),
  format: (id: string) => [PROMPT_ID_PREFIX, id].join(DELIMITER),
};
