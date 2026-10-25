import { NextRequest, NextResponse } from "next/server";
import { analyzeIsoImage, compareIsos } from "@/lib/isoParser";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const fileA = formData.get("isoA") as File | null;
    const fileB = formData.get("isoB") as File | null;

    if (!fileA || !fileB) {
      return NextResponse.json(
        { success: false, error: "Vă rugăm să selectați ambele fișiere ISO pentru comparare." },
        { status: 400 }
      );
    }

    const bufA = new Uint8Array(await fileA.arrayBuffer());
    const bufB = new Uint8Array(await fileB.arrayBuffer());

    const analysisA = analyzeIsoImage(bufA, fileA.name);
    const analysisB = analyzeIsoImage(bufB, fileB.name);

    const compareResult = compareIsos(analysisA, analysisB);

    return NextResponse.json(compareResult);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Eroare la compararea imaginilor ISO" },
      { status: 500 }
    );
  }
}
