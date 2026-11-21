import { listMedicines, addMedicine } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const medicines = listMedicines();
    return jsonOk({ medicines });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list medicines";
    return jsonError(message, 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const description = String(body.description ?? "").trim();
    const defaultDosage = String(body.defaultDosage ?? "").trim();
    const category = String(body.category ?? "").trim();

    if (!name) {
      return jsonError("Medicine name is required", 400);
    }

    const created = addMedicine({
      name,
      description,
      defaultDosage,
      category,
      createdBy: body.createdBy || "Manufacturer",
    });

    return jsonOk({ medicine: created });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to add medicine";
    if (message.includes("UNIQUE constraint failed")) {
      return jsonError("A medicine with this name already exists", 409);
    }
    return jsonError(message, 500);
  }
}
