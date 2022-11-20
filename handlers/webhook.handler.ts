import { APIGatewayProxyEvent } from "aws-lambda";
import { createResponse } from "../utils/response";
import { Predication, PredicationId, PredicationRecord } from "./domain";
import { getClient, TABLE_NAME } from "./dynamodb";
import { Lambda } from "aws-sdk";
import { getStringParameter } from "./ssm";

const client = getClient();
const lambda = new Lambda();

export const webhook = async (event: APIGatewayProxyEvent) => {
  console.log(event.body, event.queryStringParameters);

  const { connectionId, predicationId } = event.queryStringParameters ?? {};

  if (event.body == null || !connectionId || !predicationId) {
    return createResponse({
      statusCode: 400,
      body: { message: "invalid body" },
    });
  }

  const payload = JSON.parse(event.body) as Predication;
  const stored = await client
    .get({
      TableName: TABLE_NAME,
      Key: { pk: PredicationId.format(predicationId) },
    })
    .promise()
    .then((res) => res.Item as PredicationRecord);

  if (!stored) {
    console.error(`Predication not found. id: ${predicationId}`);
    return createResponse({
      statusCode: 404,
      body: { message: `Not found.` },
    });
  }

  await client
    .update({
      TableName: TABLE_NAME,
      Key: {
        pk: stored.pk,
      },
      UpdateExpression: "set #body = :body",
      ExpressionAttributeNames: { "#body": "body" },
      ExpressionAttributeValues: {
        ":body": payload,
      },
    })
    .promise();

  const invoked = await lambda
    .invoke({
      FunctionName: process.env.DOWNSTREAM_FN_NAME!,
      Payload: JSON.stringify({
        connectionId,
        predicationId,
        outputs: payload.output,
      }),
    })
    .promise();

  console.log("downstream response:", JSON.stringify(invoked, undefined, 2));

  if (!invoked.Payload) {
    return createResponse({
      statusCode: 400,
      body: { message: `Failed to invoke down stream function.` },
    });
  }

  return createResponse({
    statusCode: 200,
    body: { message: "success" },
  });
};

export const getWebhookUrl = async (
  connectionId: string,
  predicationId: string
) => {
  return `${await getStringParameter(
    "WebhookApiUrl"
  )}webhook?connectionId=${encodeURIComponent(
    connectionId
  )}&predicationId=${encodeURIComponent(PredicationId.extract(predicationId))}`;
};
