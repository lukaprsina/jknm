"use server";

import { parse as csvParse } from "csv-parse/sync";
import { XMLParser } from "fast-xml-parser";
import path from "path";
import fs_promises from "node:fs/promises";
import type { ImportedArticle } from "./converter-spaghetti";

interface ObjaveType {
  ID: number;
  Kategorija: number;
  Naslov: string;
  Tekst: string;
  Datum1: string;
  ZadnjaSprememba: string;
}

interface XMLType {
  "?xml": string;
  dataroot: {
    Objave: ObjaveType[];
  };
}

// CSV columns: ID,DatumVnos,Kategorija,Jezik,Naslov,Povzetek,Tekst,Datum,Datum1,Datum2,Objavi,Zap,Obmocje,Avtor,Vnasalec,ZadnjaSprememba
export async function read_from_csv() {
  const imported_articles: ImportedArticle[] = [];

  const objave_path = path.join(process.cwd(), "src/assets/Objave copy.csv");
  const objave_string = await fs_promises.readFile(objave_path, "utf8");
  // Use csv-parse/sync for synchronous parsing
  const records = csvParse(objave_string, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as ObjaveType[];

  for (const objava of records) {
    // Kategorija is a string in CSV, convert to number
    const kategorija = objava.Kategorija
    switch (kategorija) {
      case 1: {
        imported_articles.push({
          objave_id: objava.ID,
          title: objava.Naslov,
          content: objava.Tekst,
          created_at: objava.Datum1,
          updated_at: objava.ZadnjaSprememba,
        });
        break;
      }
      case 2: {
        break;
      }
      default: {
        throw new Error("Neznana kategorija");
      }
    }
  }

  return imported_articles;
}

export async function read_from_xml() {
  const imported_articles: ImportedArticle[] = [];

  const objave_path = path.join(process.cwd(), "src/assets/Objave.xml");
  const objave_string = await fs_promises.readFile(objave_path, "utf8");
  const parser = new XMLParser();
  const objave = parser.parse(objave_string) as XMLType;

  for (const objava of objave.dataroot.Objave) {
    switch (objava.Kategorija) {
      case 1: {
        imported_articles.push({
          objave_id: objava.ID,
          title: objava.Naslov,
          content: objava.Tekst,
          created_at: objava.Datum1,
          updated_at: objava.ZadnjaSprememba,
        });
        break;
      }
      case 2: {
        break;
      }
      default: {
        throw new Error("Neznana kategorija");
      }
    }
  }

  // console.log(csv_articles.find((a) => a.id == "40")?.content);

  return imported_articles;
}
