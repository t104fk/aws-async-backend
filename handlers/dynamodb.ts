import { DynamoDB } from "aws-sdk";
export const getClient = () => {
  return new DynamoDB.DocumentClient({
    region: "ap-northeast-1",
  });
};
export const TABLE_NAME = process.env.TABLE_NAME!;
