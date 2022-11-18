import * as aws from "aws-sdk";
const ssm = new aws.SSM({
  region: "ap-northeast-1",
});

export const getWebhookApiUrl = async () =>
  ssm
    .getParameter({ Name: "WebhookApiUrl" })
    .promise()
    .then((p) => p.Parameter?.Value);
