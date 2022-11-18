import axios from "axios";
import { Predication, Prompt, PromptRecord } from "./domain";

const URL = "https://api.replicate.com/v1/predictions";
export const generate = async (record: PromptRecord) => {
  return axios.post<Predication>(
    URL,
    {
      version: process.env.REPLICATE_VERSION,
      input: record.payload,
      webhook_completed: record.webhook_completed,
    },
    {
      headers: {
        Authorization: `Token ${process.env.REPLICATE_TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );
};
