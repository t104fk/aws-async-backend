import { PutItemInput } from "aws-sdk/clients/dynamodb";
import { PredicationId, Prompt } from "./domain";
import { getClient, TABLE_NAME } from "./dynamodb";
import { getStringParameter } from "./ssm";

const client = getClient();

type RequestPayload = {
  connectionId: string;
  // TODO: from header?
  userId: string;
  payload: Prompt;
};
export const request = async ({
  connectionId,
  userId,
  payload,
}: RequestPayload) => {
  const predicationId = PredicationId.generate();
  // const webhook = `${await getStringParameter(
  //   "WebhookApiUrl"
  // )}webhook?connectionId=${encodeURIComponent(
  //   connectionId
  // )}&predicationId=${encodeURIComponent(PredicationId.extract(predicationId))}`;

  const item = {
    pk: predicationId,
    gsi1pk: userId,
    payload,
    // webhook_completed: webhook,
    connectionId,
    createdAt: new Date().getTime(),
  };

  console.log("input record", item);

  await client
    .put({
      TableName: TABLE_NAME,
      Item: item,
    })
    .promise();

  return client
    .get({ TableName: TABLE_NAME, Key: { pk: predicationId } })
    .promise();
};
