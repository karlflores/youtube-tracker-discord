const globals = globalThis as unknown as {
  browser?: typeof chrome;
  chrome?: typeof chrome;
};

const detectedBrowserApi = globals.browser ?? globals.chrome;

if (!detectedBrowserApi) {
  throw new Error("No WebExtension browser API is available.");
}

export const browserApi: typeof chrome = detectedBrowserApi;
