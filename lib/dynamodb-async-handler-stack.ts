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

    this.producer.addToRolePolicy(
      new PolicyStatement({
        actions: ["dynamodb:GetItem", "dynamodb:PutItem"],
        resources: [table.tableArn],
      })
    );
    this.producer.addToRolePolicy(
      new PolicyStatement({
        actions: ["ssm:GetParameter"],
        resources: [store.parameterArn],
      })
    );

    const dynamoConsumer = new NodejsFunction(this, "dynamoConsumer", {
      entry: "handlers/dynamodb.handler.ts",
      handler: "consume",
      environment: {
        TABLE_NAME: table.tableName,
        REPLICATE_VERSION: replicateVersion.valueAsString,
        REPLICATE_TOKEN: replicateToken.valueAsString,
      },
    });

    // dynamoConsumer.addToRolePolicy(
    //   new PolicyStatement({
    //     actions: [
    //       "dynamodb:GetRecords",
    //       "dynamodb:GetShardIterator",
    //       "dynamodb:DescribeStream",
    //       "dynamodb:ListStreams",
    //     ],
    //     resources: [table.tableStreamArn!],
    //   })
    // );
    // dynamoConsumer.addToRolePolicy(
    //   new PolicyStatement({
    //     actions: ["dynamodb:PutItem"],
    //     resources: [table.tableArn!],
    //   })
    // );

    dynamoConsumer.addEventSourceMapping("AsyncDynamoConsumer", {
      eventSourceArn: table.tableStreamArn,
      batchSize: 1,
      startingPosition: lambda.StartingPosition.LATEST,
      retryAttempts: 3,
    });
    props.table.grantReadWriteData(dynamoConsumer);
    props.table.grantStreamRead(dynamoConsumer);
  }
}
