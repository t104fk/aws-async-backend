import { Construct } from "constructs";
import { CfnParameter } from "aws-cdk-lib";

export class CfParameterStack extends Construct {
  public readonly replicateVersion: CfnParameter;
  public readonly replicateToken: CfnParameter;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.replicateVersion = new CfnParameter(this, "replicateVersion", {
      type: "String",
      description: "The version hash of Replicate app.",
    });
    this.replicateToken = new CfnParameter(this, "replicateToken", {
      type: "String",
      description: "The token of Replicate account.",
    });
  }
}
