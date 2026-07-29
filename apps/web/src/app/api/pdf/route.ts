import { generateSimulationPdf } from "@/lib/pdf";
import type { SimulationInput, SimulationResult } from "@separation/schemas";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { simulation, result, email } = body as {
      simulation: SimulationInput;
      result: SimulationResult;
      email?: string;
    };

    if (!simulation || !result) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    const pdfBuffer = await generateSimulationPdf(simulation, result, email);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="clarte-simulation.pdf"`,
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}
