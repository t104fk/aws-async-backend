import { Construct } from "constructs";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { CfnParameter } from "aws-cdk-lib";

export interface DynamoDBAsyncHandlerStackProps {
  table: dynamodb.Table;
  store: ssm.StringParameter;
  replicateVersion: CfnParameter;
  replicateToken: CfnParameter;
}

export class DynamoDBAsyncHandlerStack extends Construct {
  public readonly producer: lambda.IFunction;

  constructor(
    scope: Construct,
    id: string,
    props: DynamoDBAsyncHandlerStackProps
  ) {
    super(scope, id);

    const { table, store, replicateVersion, replicateToken } = props;

    this.producer = new NodejsFunction(this, "dynamoProducer", {
      entry: "handlers/dynamodb.handler.ts",
      handler: "produce",
      environment: {
        TABLE_NAME: table.tableName,
      },
    });
    table.grantReadWriteData(this.producer);
    // store.grantRead(this.producer);

    const dynamoConsumer = new NodejsFunction(this, "dynamoConsumer", {
      entry: "handlers/dynamodb.handler.ts",
      handler: "consume",
      environment: {
        TABLE_NAME: table.tableName,
        REPLICATE_VERSION: replicateVersion.valueAsString,
        REPLICATE_TOKEN: replicateToken.valueAsString,
      },
    });

    dynamoConsumer.addEventSourceMapping("AsyncDynamoConsumer", {
      eventSourceArn: table.tableStreamArn,
      batchSize: 1,
      startingPosition: lambda.StartingPosition.LATEST,
      retryAttempts: 3,
    });
    table.grantReadWriteData(dynamoConsumer);
    table.grantStreamRead(dynamoConsumer);
    store.grantRead(dynamoConsumer);
  }
}
