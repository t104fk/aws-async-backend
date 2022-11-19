import { Construct } from "constructs";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";

export interface WebhookStackProps {
  table: dynamodb.Table;
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
      },
    });
    webhook.addToRolePolicy(
      new PolicyStatement({
        actions: ["dynamodb:GetItem", "dynamodb:PutItem"],
        resources: [props.table.tableArn],
      })
    );

    const webhookResources = webhookApi.root.addResource("webhook");
    webhookResources.addMethod(
      "POST",
      new apigateway.LambdaIntegration(webhook)
    );

    this.store = new ssm.StringParameter(this, "WebhookApiUrlParameter", {
      parameterName: "WebhookApiUrl",
      stringValue: webhookApi.url,
    });
  }
}
