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
      entry: "handlers/notifier.handler.ts",
      handler: "connect",
      environment: {
        TABLE_NAME: table.tableName,
      },
    });

    table.grantWriteData(connect);
    const disconnect = new NodejsFunction(this, "websocketDisconnect", {
      entry: "handlers/notifier.handler.ts",
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
      entry: "handlers/notifier.handler.ts",
      handler: "notify",
      environment: {
        TABLE_NAME: table.tableName,
      },
    });
    table.grantReadData(this.handler);
    webSocketApi.grantManageConnections(this.handler);
    const accountId = webSocketApi.env.account;
    this.handler.addToRolePolicy(
      new PolicyStatement({
        actions: ["execute-api:Invoke"],
        resources: [
          `arn:aws:execute-api:${region}:${accountId}:${apiId}/${stage}/*`,
        ],
      })
    );

    const store = new ssm.StringParameter(this, "WebSocketApiParameter", {
      parameterName: "websocketApiEndpoint",
      // stringValue: `${webSocketApi.apiEndpoint}/${stage}`,
      stringValue: `${endpoint}/${stage}`,
    });
    store.grantRead(this.handler);

    webSocketApi.addRoute("send-messages", {
      integration: new WebSocketLambdaIntegration(
        "SendMessageIntegration",
        this.handler
      ),
    });
  }
}
