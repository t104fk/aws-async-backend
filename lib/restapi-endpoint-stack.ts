import { Construct } from "constructs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";

type Endpoint = {
  resourceName: string;
  method: string;
  integration: apigateway.LambdaIntegration;
};
export interface RestApiEndpointStackProps {
  endpoints: Endpoint[];
}

export class RestApiEndpointStack extends Construct {
  constructor(scope: Construct, id: string, props: RestApiEndpointStackProps) {
    super(scope, id);

    const api = new apigateway.RestApi(this, "RestApi", {
      restApiName: `rest-api`,
      deployOptions: {
        stageName: "v1",
      },
    });

    for (const endpoint of props.endpoints) {
      // TODO: check existence
      let resource = api.root.getResource(endpoint.resourceName);
      if (!resource) {
        resource = api.root.addResource(endpoint.resourceName);
      }
      resource.addMethod(endpoint.method, endpoint.integration);
    }
  }
}
