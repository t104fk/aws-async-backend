import { unmarshall } from "@aws-sdk/util-dynamodb";
import { APIGatewayProxyEvent, DynamoDBStreamEvent } from "aws-lambda";
import { createResponse } from "../utils/response";
import { Prompt, PromptId, PromptRecord } from "./domain";
import { getClient, TABLE_NAME } from "./dynamodb";
import { generate } from "./replicate";
import { getWebhookApiUrl } from "./ssm";

const client = getClient();

const filterPromptInsertRecord = (event: DynamoDBStreamEvent) =>
  event.Records.filter((r) => r.eventName === "INSERT")
    .map((r) => unmarshall(r.dynamodb?.NewImage!) as PromptRecord)
    .filter((r) => r.id.startsWith(PromptId.prefix));

export const consume = async (event: DynamoDBStreamEvent) => {
  console.log(JSON.stringify(event));

  const records = filterPromptInsertRecord(event);
  if (!records.length) return;

  for (const record of records) {
    const predication = await generate(record);
    console.log("generated", predication);
    if (predication.status !== 201) return;

    const predicated = predication.data;

    await client
      .put({
        TableName: TABLE_NAME,
        // TODO: updatedAt
        Item: {
          ...predicated,
          gsi1pk: record.userId,
        },
      })
      .promise();
  }
};

export const produce = async (event: APIGatewayProxyEvent) => {
  if (event.body == null) {
    return createResponse({
      statusCode: 400,
      body: { message: "invalid body" },
    });
  }
  const payload = JSON.parse(event.body);
  const id = PromptId.generate();

  const webhook = `${await getWebhookApiUrl()}webhook`;

  // TODO: createdAt
  await client
    .put({
      TableName: TABLE_NAME,
      Item: {
        id,
        payload,
        webhook_completed: webhook,
        userId: "user#b9233c5d-9ed0-41bc-8884-bdddea1d31aa",
      },
    })
    .promise();

  // TODO: error handling
  return createResponse({
    statusCode: 200,
    body: { message: "success" },
  });
};
