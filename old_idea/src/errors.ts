export class BlueprinterError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "BlueprinterError";
  }
}

export class PipelinePassError extends BlueprinterError {
  constructor(pass: string, attempts: number, lastError: string) {
    super("PIPELINE_PASS_FAILURE", `Pass ${pass} failed after ${attempts} attempts: ${lastError}`);
  }
}

export class CircularDependencyError extends BlueprinterError {
  constructor(cycles: string[]) {
    super("CIRCULAR_DEPENDENCY", `Circular dependencies detected: ${cycles.join(", ")}`);
  }
}
