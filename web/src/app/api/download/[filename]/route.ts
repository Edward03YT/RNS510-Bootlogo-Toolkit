import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { getGeneratedFile } from "@/lib/storage";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    const safeFilename = path.basename(filename);

    const file = await getGeneratedFile(safeFilename);
    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    return new NextResponse(file.buffer as any, {
      status: 200,
      headers: {
        "Content-Disposition": `attachment; filename="${safeFilename}"`,
        "Content-Type": file.contentType,
        "Content-Length": file.buffer.length.toString(),
        "Cache-Control": "no-cache",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
