const PROXY_URL_PATTERN = /^(https?|socks5h?):\/\/[^/\s]+/i;

export const isValidProxyUrl = (value: unknown): boolean =>
  value === "" || value == null || (typeof value === "string" && PROXY_URL_PATTERN.test(value));
