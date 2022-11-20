import { CfnParameter, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { WebhookStack } from "./webhook-stack";
import { CfParameterStack } from "./cloudformation-parameters";
import { RestApiEndpointStack } from "./restapi-endpoint-stack";
import { DynamoDBAsyncHandlerStack } from "./dynamodb-async-handler-stack";
import { SQSAsyncHandlerStack } from "./sqs-async-handler-stack";
import { DynamoDBStack } from "./dynamodb-stack";
import { WebSocketStack } from "./websocket-stack";

export class AwsAsyncBackendStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const sqsAsyncBackendStack = new SQSAsyncHandlerStack(
      this,
      "SQSAsyncHandlerStack"
    );

    const dynamodbStack = new DynamoDBStack(this, "DynamoDBStack");

    const webSocket = new WebSocketStack(this, "WebSocketStack", {
      table: dynamodbStack.table,
    });

    const webhook = new WebhookStack(this, "WebhookStack", {
      table: dynamodbStack.table,
      downstream: webSocket.handler,
    });

    const replicateVersion = new CfnParameter(this, "replicateVersion", {
      type: "String",
      description: "The version hash of Replicate app.",
    });
    const replicateToken = new CfnParameter(this, "replicateToken", {
      type: "String",
      description: "The token of Replicate account.",
    });

    // const cfParameters = new CfParameterStack(this, "CfParameters");
    const ddbAsyncBackendStack = new DynamoDBAsyncHandlerStack(
      this,
      "DynamoDBAsyncHandlerStack",
      {
        table: dynamodbStack.table,
        store: webhook.store,
        replicateVersion,
        replicateToken,
      }
    );

    new RestApiEndpointStack(this, "RestApiEndpointStack", {
      endpoints: [
        {
          resourceName: "sqs-async",
          method: "POST",
          integration: new apigateway.LambdaIntegration(
            sqsAsyncBackendStack.producer
          ),
        },
        {
          resourceName: "dynamo-async",
          method: "POST",
          integration: new apigateway.LambdaIntegration(
            ddbAsyncBackendStack.producer
          ),
        },
      ],
    });
  }
}
