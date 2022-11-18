export const createResponse = ({
  statusCode,
  body,
  isBase64Encoded = false,
}: {
  statusCode: number;
  body: any;
  isBase64Encoded?: boolean;
}) => {
  return {
    isBase64Encoded: isBase64Encoded,
    statusCode: statusCode || 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "authorization, access-control-allow-origin",
      "Access-Control-Allow-Credentials": true,
      // TODO: other
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body || {}),
  };
};
