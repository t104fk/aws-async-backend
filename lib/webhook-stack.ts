import { Construct } from "constructs";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";

export interface WebhookStackProps {
  table: dynamodb.Table;
  downstream: lambda.IFunction;
}

export class WebhookStack extends Construct {
  public readonly store: ssm.StringParameter;

  constructor(scope: Construct, id: string, props: WebhookStackProps) {
    super(scope, id);

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
        TABLE_NAME: props.table.tableName,
        DOWNSTREAM_FN_NAME: props.downstream.functionName,
      },
    });
    props.table.grantReadWriteData(webhook);
    // webhook.addToRolePolicy(
    //   new PolicyStatement({
    //     actions: ["dynamodb:GetItem", "dynamodb:PutItem"],
    //     resources: [props.table.tableArn],
    //   })
    // );

    const webhookResources = webhookApi.root.addResource("webhook");
    webhookResources.addMethod(
      "POST",
      new apigateway.LambdaIntegration(webhook)
    );

    this.store = new ssm.StringParameter(this, "WebhookApiUrlParameter", {
      parameterName: "WebhookApiUrl",
      stringValue: webhookApi.url,
    });

    props.downstream.grantInvoke(webhook);
  }
}
