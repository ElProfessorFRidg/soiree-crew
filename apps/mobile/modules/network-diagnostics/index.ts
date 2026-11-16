import { requireOptionalNativeModule } from "expo";

export interface NativeNetworkProbe {
  code: string;
  httpStatus: number;
  durationMs: number;
  native: boolean;
  contractValid: boolean;
  requestId?: string;
  retryAfterSeconds?: number;
  nativeErrorCode?: number;
  timings?: Record<string, number>;
}

const native = requireOptionalNativeModule<{ probeAsync(baseURL: string, endpoint: string): Promise<NativeNetworkProbe> }>("CrewNetworkDiagnostics");
export const hasNativeNetworkProbe = !!native;
export const nativeNetworkProbe = (baseURL: string, endpoint: string) => native?.probeAsync(baseURL, endpoint) ?? null;
