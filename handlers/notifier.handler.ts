import { ApiGatewayManagementApi } from "aws-sdk";
import { createResponse } from "../utils/response";
import { ConnectionId } from "./connection.handler";
import { PredicationId, PredicationRecord } from "./domain";
import { getClient, TABLE_NAME } from "./dynamodb";
import { getStringParameter } from "./ssm";

const client = getClient();

type RequestPayload = {
  connectionId: string;
  predicationId: string;
};

export const notify = async (event: RequestPayload) => {
  console.log(event);

  if (event == null) {
    return createResponse({
      statusCode: 400,
      body: { message: "Empty request body." },
    });
  }

  const { connectionId, predicationId } = event;
  const endpoint = await getStringParameter("websocketApiEndpoint");
  console.log(connectionId, predicationId, endpoint);

  // TODO: もしどれかないならクライアントからリクエスト来てない気がする？
  if (!connectionId || !predicationId) {
    return createResponse({
      statusCode: 400,
      body: { message: "invalid request body." },
    });
  }

  const stored = await client
    .get({
      TableName: TABLE_NAME,
      Key: { pk: PredicationId.format(predicationId) },
    })
    .promise()
    .then((res) => res.Item as PredicationRecord);

  const params: ApiGatewayManagementApi.PostToConnectionRequest = {
    Data: JSON.stringify({ predicationId, outputs: stored.body.output }),
    ConnectionId: connectionId,
  };

  const apiGateway = new ApiGatewayManagementApi({ endpoint });
  try {
    await apiGateway.postToConnection(params).promise();
  } catch (err) {
    console.error(err);

    // if (err.statusCode === 410) {
    //   console.log("Found stale connection, deleting " + data.connectionId);
    //   await client
    //     .delete({
    //       TableName: process.env.TABLE_NAME || "",
    //       Key: { [process.env.TABLE_KEY || ""]: data.connectionId },
    //     })
    //     .promise();
    // } else {
    //   console.log("Failed to post. Error: " + JSON.stringify(err));
    // }
  }

  // TODO: error handling
  return createResponse({
    statusCode: 200,
    body: { message: "success" },
  });
};

// const getEndpoint = async (connectionId: string) =>
//   `${await getStringParameter(
//     "websocketApiEndpoint"
//   )}/@connections/${connectionId}`;

export const connect = async (event: WebSocketEvent) => {
  console.log("connect event", event);
  const { requestContext } = event;
  const connectionId = ConnectionId.format(requestContext.connectionId);
  const userId = "user#b9233c5d-9ed0-41bc-8884-bdddea1d31aa";
  await client
    .put({
      TableName: TABLE_NAME,
      Item: {
        pk: connectionId,
        gsi1pk: userId,
        createdAt: new Date().getTime(),
      },
    })
    .promise()
    .catch((err) => console.error(err));
  console.log("connected", connectionId);
  return {
    statusCode: 200,
    body: "onConnect.",
  };
};

export const disconnect = async (event: WebSocketEvent) => {
  console.log("disconnect event", event);
  const { requestContext } = event;
  const connectionId = ConnectionId.format(requestContext.connectionId);
  await client
    .delete({
      TableName: TABLE_NAME,
      Key: {
        pk: connectionId,
      },
    })
    .promise()
    .catch((err) => console.error(err));
  console.log("disconnected", connectionId);
  return {
    statusCode: 200,
    body: "onDisconnect.",
  };
};

export type WebSocketEvent = {
  requestContext: {
    routeKey: string;
    eventType: "CONNECT" | "DISCONNECT" | "MESSAGE";
    connectionId: string;
  };
  multiValueHeaders: { [key: string]: string[] };
  isBase64Encoded: boolean;
  // body: RequestPayload;
};

// export type WebSocketEvent = {
//   id: string;
//   event: {
//     requestContext: {
//       routeKey: string;
//       eventType: "CONNECT" | "DISCONNECT" | "MESSAGE";
//       connectionId: string;
//     };
//     multiValueHeaders: { [key: string]: string[] };
//     body: string;
//   };

//   context: {
//     postToConnection: (body: any, connectionId: string) => Promise<void>;
//   };
//   // message は any json だが、このプロジェクトでは常にこの形として定義する
//   message: {
//     action: string;
//     body: any;
//   };
// };
