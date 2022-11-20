import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as apigwv2 from "@aws-cdk/aws-apigatewayv2-alpha";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { WebSocketLambdaIntegration } from "@aws-cdk/aws-apigatewayv2-integrations-alpha";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";

export interface WebSocketStackProps {
  table: dynamodb.Table;
}

export class WebSocketStack extends Construct {
  public readonly handler: lambda.Function;

  constructor(scope: Construct, id: string, props: WebSocketStackProps) {
    super(scope, id);

    const { table } = props;

    const connect = new NodejsFunction(this, "websocketConnect", {
      entry: "handlers/websocket.handler.ts",
      handler: "connect",
      environment: {
        TABLE_NAME: table.tableName,
      },
    });

    table.grantWriteData(connect);
    const disconnect = new NodejsFunction(this, "websocketDisconnect", {
      entry: "handlers/websocket.handler.ts",
      handler: "disconnect",
      environment: {
        TABLE_NAME: table.tableName,
      },
    });
    table.grantWriteData(disconnect);

    const webSocketApi = new apigwv2.WebSocketApi(this, "WebSocketApi", {
      connectRouteOptions: {
        integration: new WebSocketLambdaIntegration(
          "WebSocketApiConnection",
          connect
        ),
      },
      disconnectRouteOptions: {
        integration: new WebSocketLambdaIntegration(
          "WebSocketApiDisconnection",
          disconnect
        ),
      },
    });
    const stage = "v1";
    new apigwv2.WebSocketStage(this, "webSocketApiStage", {
      webSocketApi,
      stageName: "v1",
      autoDeploy: true,
    });

    const region = webSocketApi.env.region;
    const apiId = webSocketApi.apiId;
    const endpoint = `https://${apiId}.execute-api.${region}.amazonaws.com`;

    this.handler = new NodejsFunction(this, "predicationNotifier", {
      entry: "handlers/websocket.handler.ts",
      handler: "notify",
      environment: {
        TABLE_NAME: table.tableName,
      },
    });
    table.grantReadData(this.handler);
    webSocketApi.grantManageConnections(this.handler);
    const accountId = webSocketApi.env.account;

    const apiArn = `arn:aws:execute-api:${region}:${accountId}:${apiId}/${stage}/*`;
    this.handler.addToRolePolicy(
      new PolicyStatement({
        actions: ["execute-api:Invoke"],
        resources: [apiArn],
      })
    );

    const store = new ssm.StringParameter(this, "WebSocketApiParameter", {
      parameterName: "websocketApiEndpoint",
      stringValue: `${endpoint}/${stage}`,
    });
    store.grantRead(this.handler);

    const receiver = new NodejsFunction(this, "receiver", {
      entry: "handlers/websocket.handler.ts",
      handler: "receive",
      environment: {
        TABLE_NAME: table.tableName,
      },
    });
    table.grantReadWriteData(receiver);
    store.grantRead(receiver);
    webSocketApi.grantManageConnections(receiver);
    receiver.addToRolePolicy(
      new PolicyStatement({
        actions: ["execute-api:Invoke"],
        resources: [apiArn],
      })
    );

    webSocketApi.addRoute("messages", {
      integration: new WebSocketLambdaIntegration(
        "SendMessageIntegration",
        // this.handler
        receiver
      ),
    });

    // webSocketApi.addRoute("receive", {
    //   integration: new WebSocketLambdaIntegration(
    //     "ReceiveMessageIntegration",
    //     receiver
    //   ),
    // });
  }
}
