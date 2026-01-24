/**
 * Remotion entry point for bundling
 * This file is used by @remotion/bundler to create the render bundle
 */
import { registerRoot } from "remotion";
import { SnipRoot } from "./root";

registerRoot(SnipRoot);
