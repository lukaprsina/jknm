import { NextResponse } from "next/server";
import { db } from "~/server/db";

export const dynamic = "force-dynamic"; // static by default, unless reading the request

export async function GET() {
  try {
    await db.query.PublishedArticle.findFirst();
  } catch (e: unknown) {
    if (e instanceof Error) {
      return NextResponse.json({ message: e.message }, { status: 500 });
    } else {
      return NextResponse.json({ message: "Unknown error" }, { status: 500 });
    }
  }

  return NextResponse.json({ message: "Success" }, { status: 200 });
}
