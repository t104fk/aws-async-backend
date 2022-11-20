const CONNECTION_ID_PREFIX = "connection";
const DELIMITER = "#";
export const ConnectionId = {
  format: (id: string) => [CONNECTION_ID_PREFIX, id].join(DELIMITER),
  extract: (id: string) =>
    id.includes(DELIMITER) ? id.split(DELIMITER)[1] : id,
};
