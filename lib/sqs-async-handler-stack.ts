import { Construct } from "constructs";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Duration } from "aws-cdk-lib";

export class SQSAsyncHandlerStack extends Construct {
  public readonly producer: lambda.IFunction;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // const deadLetterQueue = new sqs.Queue(this, "dlq", {
    //   queueName: `async-dl-queue`,
    // });
    const queue = new sqs.Queue(this, "AsyncBackendQueue", {
      queueName: "async-backend-queue.fifo",
      visibilityTimeout: Duration.seconds(300),
      fifo: true,
      // deadLetterQueue: {
      //   queue: deadLetterQueue,
      //   maxReceiveCount: 3,
      // },
    });

    this.producer = new NodejsFunction(this, "sqsProducer", {
      entry: "handlers/sqs.handler.ts",
      handler: "produce",
      environment: {
        QUEUE_URL: queue.queueUrl,
      },
    });

    this.producer.addToRolePolicy(
      new PolicyStatement({
        actions: ["sqs:SendMessage"],
        resources: [queue.queueArn],
      })
    );
  }
}
