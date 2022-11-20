import * as aws from "aws-sdk";
const ssm = new aws.SSM({
  region: "ap-northeast-1",
});

export const getStringParameter = async (name: string) =>
  ssm
    .getParameter({ Name: name })
    .promise()
    .then((p) => p.Parameter?.Value);
