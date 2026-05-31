import { getDeclaration, getDeclarationLines } from "../../db/declarationStore.ts";
import { toDamancomRecord } from "./cnssMapper.ts";
import { generateDamancomTxt } from "../exports/txtExport.ts";
import { generateCsv } from "../exports/csvExport.ts";
import { generateDeclarationXml } from "../exports/xmlExport.ts";

export type ExportFormat = "txt" | "csv" | "xml";

export async function exportCnssDeclaration(
  declarationId: string,
  format: ExportFormat,
  companyName?: string,
): Promise<{ content: string; filename: string; mimeType: string }> {
  const [decl, lines] = await Promise.all([
    getDeclaration(declarationId),
    getDeclarationLines(declarationId),
  ]);
  if (!decl) throw new Error("Déclaration introuvable");

  const period = decl.period;

  switch (format) {
    case "txt": {
      const records = lines.map(toDamancomRecord);
      const content = generateDamancomTxt(records, period, companyName ?? "Company");
      return {
        content,
        filename: `cnss_${period}_damancom.txt`,
        mimeType: "text/plain",
      };
    }
    case "csv": {
      const content = generateCsv(lines);
      return {
        content,
        filename: `cnss_${period}.csv`,
        mimeType: "text/csv",
      };
    }
    case "xml": {
      const content = generateDeclarationXml(decl, lines);
      return {
        content,
        filename: `cnss_${period}.xml`,
        mimeType: "application/xml",
      };
    }
  }
}
