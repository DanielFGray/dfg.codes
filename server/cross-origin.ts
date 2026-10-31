export const getCrossOriginHeaders = (pathname = "/"): Record<string, string> => ({
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": pathname.startsWith("/node-preview")
    ? "require-corp"
    : "credentialless",
});

export const applyCrossOriginHeaders = (
  setHeader: (name: string, value: string) => void,
  pathname = "/",
): void => {
  const headers = getCrossOriginHeaders(pathname);

  for (const [name, value] of Object.entries(headers)) {
    setHeader(name, value);
  }
};
