import axios from "axios";
import { Predication, Prompt, PredicationRecord } from "./domain";

const URL = "https://api.replicate.com/v1/predictions";
export const generate = async (record: PredicationRecord, webhook: string) => {
  return axios.post<Predication>(
    URL,
    {
      version: process.env.REPLICATE_VERSION,
      input: record.payload,
      webhook_completed: webhook,
    },
    {
      headers: {
        Authorization: `Token ${process.env.REPLICATE_TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );
};
