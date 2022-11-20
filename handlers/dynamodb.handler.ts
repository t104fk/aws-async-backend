import { unmarshall } from "@aws-sdk/util-dynamodb";
import { APIGatewayProxyEvent, DynamoDBStreamEvent } from "aws-lambda";
import { createResponse } from "../utils/response";
import { PredicationId, PredicationRecord, Prompt } from "./domain";
import { getClient, TABLE_NAME } from "./dynamodb";
import { generate } from "./replicate";
import { request } from "./ImageGenerationService";
import { getWebhookUrl } from "./webhook.handler";

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
    const webhook = await getWebhookUrl(record.connectionId, record.pk);
    const predication = await generate(record, webhook);
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

  await request({ connectionId, userId, payload: body.payload });

  // TODO: error handling
  return createResponse({
    statusCode: 200,
    body: { predicationId: PredicationId.extract(predicationId) },
  });
};
