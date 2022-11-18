import { CfnParameter, Duration, Stack, StackProps } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import * as ssm from "aws-cdk-lib/aws-ssm";

export class AwsAsyncBackendStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // const deadLetterQueue = new sqs.Queue(this, "dlq", {
    //   queueName: `async-dl-queue`,
    // });

    const queue = new sqs.Queue(this, "AwsAsyncBackendQueue", {
      queueName: "async-queue.fifo",
      visibilityTimeout: Duration.seconds(300),
      fifo: true,
      // deadLetterQueue: {
      //   queue: deadLetterQueue,
      //   maxReceiveCount: 3,
      // },
    });

    const sqsProducer = new NodejsFunction(this, "sqsProducer", {
      entry: "handlers/sqs.handler.ts",
      handler: "produce",
      environment: {
        QUEUE_URL: queue.queueUrl,
      },
    });

    sqsProducer.addToRolePolicy(
      new PolicyStatement({
        actions: ["sqs:SendMessage"],
        resources: [queue.queueArn],
      })
    );

    const table = new dynamodb.Table(this, "application", {
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    table.addGlobalSecondaryIndex({
      indexName: "GSI-1",
      partitionKey: {
        name: "promptId",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "created_at",
        type: dynamodb.AttributeType.STRING,
      },
    });

    const webhookApi = new apigateway.RestApi(this, "WebhookApi", {
      restApiName: `webhook-api`,
      deployOptions: {
        stageName: "v1",
      },
    });
    const webhook = new NodejsFunction(this, "webhook", {
      entry: "handlers/webhook.handler.ts",
      handler: "webhook",
      environment: {
        TABLE_NAME: table.tableName,
      },
    });
    webhook.addToRolePolicy(
      new PolicyStatement({
        actions: ["dynamodb:GetItem", "dynamodb:PutItem"],
        resources: [table.tableArn],
      })
    );

    const webhookResources = webhookApi.root.addResource("webhook");
    webhookResources.addMethod(
      "POST",
      new apigateway.LambdaIntegration(webhook)
    );

    const store = new ssm.StringParameter(this, "WebhookApiUrlParameter", {
      parameterName: "WebhookApiUrl",
      stringValue: webhookApi.url,
    });

    const dynamoProducer = new NodejsFunction(this, "dynamoProducer", {
      entry: "handlers/dynamodb.handler.ts",
      handler: "produce",
      environment: {
        TABLE_NAME: table.tableName,
      },
    });

    dynamoProducer.addToRolePolicy(
      new PolicyStatement({
        actions: ["dynamodb:GetItem", "dynamodb:PutItem"],
        resources: [table.tableArn],
      })
    );
    dynamoProducer.addToRolePolicy(
      new PolicyStatement({
        actions: ["ssm:GetParameter"],
        resources: [store.parameterArn],
      })
    );

    const replicateVersion = new CfnParameter(this, "replicateVersion", {
      type: "String",
      description: "The version hash of Replicate app.",
    });
    const replicateToken = new CfnParameter(this, "replicateToken", {
      type: "String",
      description: "The token of Replicate account.",
    });

    const dynamoConsumer = new NodejsFunction(this, "dynamoConsumer", {
      entry: "handlers/dynamodb.handler.ts",
      handler: "consume",
      environment: {
        TABLE_NAME: table.tableName,
        REPLICATE_VERSION: replicateVersion.valueAsString,
        REPLICATE_TOKEN: replicateToken.valueAsString,
      },
    });

    dynamoConsumer.addToRolePolicy(
      new PolicyStatement({
        actions: [
          "dynamodb:GetRecords",
          "dynamodb:GetShardIterator",
          "dynamodb:DescribeStream",
          "dynamodb:ListStreams",
          "dynamodb:PutItem",
        ],
        resources: [table.tableStreamArn!],
      })
    );
    dynamoConsumer.addToRolePolicy(
      new PolicyStatement({
        actions: ["dynamodb:PutItem"],
        resources: [table.tableArn!],
      })
    );

    dynamoConsumer.addEventSourceMapping("AsyncDynamoConsumer", {
      eventSourceArn: table.tableStreamArn,
      batchSize: 1,
      startingPosition: lambda.StartingPosition.LATEST,
      retryAttempts: 3,
    });

    const api = new apigateway.RestApi(this, "ServerlessRestApi", {
      restApiName: `rest-api`,
      deployOptions: {
        stageName: "v1",
      },
    });

    const sqsAsync = api.root.addResource("sqs-async");
    sqsAsync.addMethod("POST", new apigateway.LambdaIntegration(sqsProducer));
    const dynamoAsync = api.root.addResource("dynamo-async");
    dynamoAsync.addMethod(
      "POST",
      new apigateway.LambdaIntegration(dynamoProducer)
    );
  }
}
