import { createMockMotionProvider } from "./mockMotionProvider.mjs";

export function createMotionProvider(name = "mock") {
  switch (name) {
    case "mock":
    default:
      return createMockMotionProvider();
  }
}
