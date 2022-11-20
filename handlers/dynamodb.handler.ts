import { unmarshall } from "@aws-sdk/util-dynamodb";
import { APIGatewayProxyEvent, DynamoDBStreamEvent } from "aws-lambda";
import { createResponse } from "../utils/response";
import { ConnectionId } from "./connection.handler";
import { PredicationId, PredicationRecord, Prompt } from "./domain";
import { getClient, TABLE_NAME } from "./dynamodb";
import { generate } from "./replicate";
import { getStringParameter } from "./ssm";

const client = getClient();

const filterPromptInsertRecord = (event: DynamoDBStreamEvent) =>
  event.Records.filter((r) => r.eventName === "INSERT")
    .map((r) => unmarshall(r.dynamodb?.NewImage!) as PredicationRecord)
    .filter((r) => r.pk.startsWith(PredicationId.prefix));

export const consume = async (event: DynamoDBStreamEvent) => {
  console.log(JSON.stringify(event));

  const records = filterPromptInsertRecord(event);
  if (!records.length) return;

  for (const record of records) {
    const predication = await generate(record);
    console.log("generated", predication);
    if (predication.status !== 201) return;

    const predicated = predication.data;

    // TODO: webhookが勝つ可能性ある？
    await client
      .update({
        TableName: TABLE_NAME,
        // TODO: updatedAt
        Key: {
          pk: record.pk,
        },
        UpdateExpression: "set #body = :body",
        ExpressionAttributeNames: { "#body": "body" },
        ExpressionAttributeValues: {
          ":body": predicated,
        },
      })
      .promise();
  }
};

type RequestPayload = {
  connectionId: string;
  // TODO: from header?
  userId: string;
  payload: Prompt;
};

export const produce = async (event: APIGatewayProxyEvent) => {
  console.log(JSON.stringify(event));

  if (event.body == null) {
    return createResponse({
      statusCode: 400,
      body: { message: "invalid body" },
    });
  }
  const body = JSON.parse(event.body);

  const connectionId = body.connectionId;
  // TODO: temporaryUser, parse from body
  const userId = body.userId;
  const predicationId = PredicationId.generate();

  const webhook = `${await getStringParameter(
    "WebhookApiUrl"
  )}webhook?connectionId=${encodeURIComponent(
    connectionId
  )}&predicationId=${encodeURIComponent(PredicationId.extract(predicationId))}`;

  await client
    .put({
      TableName: TABLE_NAME,
      Item: {
        pk: predicationId,
        gsi1pk: userId,
        payload: body.payload,
        webhook_completed: webhook,
        createdAt: new Date().getTime(),
      },
    })
    .promise();

  // TODO: error handling
  return createResponse({
    statusCode: 200,
    body: { predicationId: PredicationId.extract(predicationId) },
  });
};
