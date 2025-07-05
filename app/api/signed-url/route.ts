import { NextRequest, NextResponse } from "next/server";
import { ElevenLabsClient } from "elevenlabs";

const GET = async () => {
  try {
    const agentId = process.env.ELEVENLABS_AGENT_ID;
    if (!agentId) {
      throw Error("AGENT_ID is not set");
    }

    const client = new ElevenLabsClient({
      apiKey: "sk_dc8fa59fc96c24526a8ac265ee90e86fe004f2d0b2babde6",
    });

    const response = await client.conversationalAi.getSignedUrl({
      agent_id: agentId,
    });

    return NextResponse.json({ signUrl: response.signed_url });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Failed to get signed URL" },
      { status: 500 }
    );
  }
};

export { GET };
