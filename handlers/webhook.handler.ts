import { APIGatewayProxyEvent } from "aws-lambda";
import { createResponse } from "../utils/response";
import { getClient, TABLE_NAME } from "./dynamodb";

const client = getClient();

export const webhook = async (event: APIGatewayProxyEvent) => {
  console.log(event.body);

  if (event.body == null) {
    return createResponse({
      statusCode: 400,
      body: { message: "invalid body" },
    });
  }

  const payload = JSON.parse(event.body);
  const stored = await client
    .get({ TableName: TABLE_NAME, Key: { id: payload.id } })
    .promise();

  if (!stored) {
    return createResponse({
      statusCode: 404,
      body: { message: `Not found.` },
    });
  }

  await client
    .put({
      TableName: TABLE_NAME,
      Item: {
        ...stored,
        ...payload,
      },
    })
    .promise();

  // TODO: error handling
  return createResponse({
    statusCode: 200,
    body: { message: "success" },
  });
};
