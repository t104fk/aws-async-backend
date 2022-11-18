import { APIGatewayProxyEvent } from "aws-lambda";
import { createResponse } from "../utils/response";
import { getExpirationTime, MESSAGE_GROUP, QUEUE_URL } from "./sqs";
import { v4 } from "uuid";
import { SendMessageRequest } from "aws-sdk/clients/sqs";
import { SQS } from "aws-sdk";

const sqs = new SQS();

// TODO: consume

export const produce = async (event: APIGatewayProxyEvent) => {
  if (event.body == null) {
    return createResponse({
      statusCode: 400,
      body: { message: "invalid body" },
    });
  }
  const payload = JSON.parse(event.body);
  const id = v4();
  const params: SendMessageRequest = {
    QueueUrl: QUEUE_URL,
    // MessageBody must be a string
    MessageBody: JSON.stringify({
      id,
      payload: payload,
      expiration: getExpirationTime(),
    }),
    MessageGroupId: MESSAGE_GROUP,
    // timeでいいのか？
    MessageDeduplicationId: String(new Date().getTime()),
  };

  await sqs.sendMessage(params).promise();

  // TODO: error handling
  return createResponse({
    statusCode: 200,
    body: { message: "success" },
  });
};
