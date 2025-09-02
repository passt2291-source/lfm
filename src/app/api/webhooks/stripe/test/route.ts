import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ 
    message: "Stripe webhook endpoint is accessible",
    timestamp: new Date().toISOString(),
    status: "ok"
  });
}

export async function POST(req: NextRequest) {
  console.log("[Webhook Test] Received POST request");
  console.log("[Webhook Test] Headers:", Object.fromEntries(req.headers.entries()));
  
  try {
    const body = await req.text();
    console.log("[Webhook Test] Body length:", body.length);
    console.log("[Webhook Test] Body preview:", body.substring(0, 200));
    
    return NextResponse.json({ 
      message: "Test webhook received successfully",
      timestamp: new Date().toISOString(),
      bodyLength: body.length
    });
  } catch (error) {
    console.error("[Webhook Test] Error:", error);
    return NextResponse.json({ 
      error: "Test webhook failed",
      message: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}
