import { generateBilanPdfFromPack, generateSimulationPdf } from "@/lib/pdf";
import type { ExpertExportPack } from "@/lib/separation/export-bilan-model";
import type { SimulationInput, SimulationResult } from "@separation/schemas";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { pack, simulation, result, email, proofId } = body as {
      pack?: ExpertExportPack;
      simulation?: SimulationInput;
      result?: SimulationResult;
      email?: string;
      proofId?: string;
    };

    if (pack?.chapters?.length) {
      const pdfBuffer = await generateBilanPdfFromPack({
        ...pack,
        email: email ?? pack.email,
        proofId: proofId ?? pack.proofId,
      });
      return new NextResponse(new Uint8Array(pdfBuffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="clarte-bilan-expert.pdf"`,
        },
      });
    }

    if (!simulation || !result) {
      return NextResponse.json(
        { error: "Missing pack or simulation/result" },
        { status: 400 }
      );
    }

    const pdfBuffer = await generateSimulationPdf(simulation, result, email, proofId);

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
