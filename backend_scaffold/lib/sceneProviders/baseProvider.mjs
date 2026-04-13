import { createMockProvider } from "./mockProvider.mjs";

export function createSceneProvider(providerName = "mock") {
  switch (providerName) {
    case "mock":
    default:
      return createMockProvider();
  }
}
