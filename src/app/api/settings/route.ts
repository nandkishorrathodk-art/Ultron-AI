/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { runtimeSettings, updateRuntimeSettings } from "@/lib/runtime-settings";

export async function GET() {
  return NextResponse.json({
    success: true,
    settings: {
      llmBaseUrl: runtimeSettings.llmBaseUrl,
      llmModel: runtimeSettings.llmModel,
      // Hide full API keys for security, but indicate presence
      llmApiKey: runtimeSettings.llmApiKey ? `nvapi-***` : "",
      e2bApiKey: runtimeSettings.e2bApiKey ? `e2b_***` : "",
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { llmBaseUrl, llmModel, llmApiKey, e2bApiKey } = body;

    const updates: any = {};
    if (llmBaseUrl) updates.llmBaseUrl = llmBaseUrl;
    if (llmModel) updates.llmModel = llmModel;
    if (llmApiKey && !llmApiKey.includes("***")) updates.llmApiKey = llmApiKey;
    if (e2bApiKey && !e2bApiKey.includes("***")) updates.e2bApiKey = e2bApiKey;

    updateRuntimeSettings(updates);

    return NextResponse.json({
      success: true,
      message: "Settings successfully updated in server memory",
      settings: {
        llmBaseUrl: runtimeSettings.llmBaseUrl,
        llmModel: runtimeSettings.llmModel,
        llmApiKey: runtimeSettings.llmApiKey ? `nvapi-***` : "",
        e2bApiKey: runtimeSettings.e2bApiKey ? `e2b_***` : "",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
