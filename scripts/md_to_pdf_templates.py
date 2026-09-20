#!/usr/bin/env python3
"""Convert handbook markdown templates to printable PDF files."""

from __future__ import annotations

import re
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
TPL = ROOT / "trips" / "nz" / "visa" / "templates"
FONT = Path(r"C:\Windows\Fonts\msyh.ttc")
FONT_BD = Path(r"C:\Windows\Fonts\msyhbd.ttc")


class Doc(FPDF):
    def footer(self) -> None:
        self.set_y(-12)
        self.set_font("Body", size=8)
        self.set_text_color(120, 120, 120)
        self.cell(0, 8, f"{self.page_no()}/{{nb}}", align="C")


def clean_md(text: str) -> list[tuple[str, str]]:
    """Return list of (kind, content) blocks: h1, h2, note, code, table, p."""
    lines = text.replace("\r\n", "\n").split("\n")
    blocks: list[tuple[str, str]] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            i += 1
            continue
        if line.startswith("# "):
            blocks.append(("h1", line[2:].strip()))
            i += 1
            continue
        if line.startswith("## "):
            blocks.append(("h2", line[3:].strip()))
            i += 1
            continue
        if line.startswith("> "):
            note = [line[2:].strip()]
            i += 1
            while i < len(lines) and lines[i].startswith("> "):
                note.append(lines[i][2:].strip())
                i += 1
            blocks.append(("note", "\n".join(note)))
            continue
        if line.strip().startswith("```"):
            i += 1
            buf = []
            while i < len(lines) and not lines[i].strip().startswith("```"):
                buf.append(lines[i].rstrip())
                i += 1
            i += 1  # closing fence
            blocks.append(("code", "\n".join(buf).strip("\n")))
            continue
        if "|" in line and i + 1 < len(lines) and re.match(r"^\|?\s*[-:| ]+\|", lines[i + 1]):
            rows = []
            while i < len(lines) and "|" in lines[i]:
                row = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                if not all(re.match(r"^:?-+:?$", c) for c in row):
                    rows.append(" | ".join(row))
                i += 1
            blocks.append(("table", "\n".join(rows)))
            continue
        para = [line.rstrip()]
        i += 1
        while i < len(lines) and lines[i].strip() and not lines[i].startswith(("#", ">", "```")) and "|" not in lines[i]:
            para.append(lines[i].rstrip())
            i += 1
        blocks.append(("p", "\n".join(para)))
    return blocks


def render(pdf: Doc, blocks: list[tuple[str, str]]) -> None:
    pdf.set_auto_page_break(auto=True, margin=16)
    pdf.add_page()
    for kind, content in blocks:
        if kind == "h1":
            pdf.set_font("BodyBold", size=14)
            pdf.set_text_color(30, 30, 30)
            pdf.multi_cell(0, 8, content)
            pdf.ln(2)
        elif kind == "h2":
            pdf.ln(2)
            pdf.set_font("BodyBold", size=12)
            pdf.set_text_color(40, 40, 40)
            pdf.multi_cell(0, 7, content)
            pdf.ln(1)
        elif kind == "note":
            pdf.set_fill_color(245, 242, 235)
            pdf.set_font("Body", size=9)
            pdf.set_text_color(80, 70, 55)
            pdf.multi_cell(0, 5.5, content, fill=True)
            pdf.ln(3)
        elif kind == "code":
            pdf.set_font("Body", size=9.5)
            pdf.set_text_color(25, 25, 25)
            pdf.set_fill_color(250, 250, 250)
            pdf.multi_cell(0, 5.2, content, fill=True)
            pdf.ln(3)
        elif kind == "table":
            pdf.set_font("Body", size=8)
            pdf.set_text_color(30, 30, 30)
            usable = pdf.epw
            for row in content.split("\n"):
                text = "- " + row
                # long table rows: wrap safely within page width
                pdf.multi_cell(usable, 4.8, text)
            pdf.ln(2)
        else:
            pdf.set_font("Body", size=10)
            pdf.set_text_color(40, 40, 40)
            pdf.multi_cell(0, 5.5, content)
            pdf.ln(2)


def convert_one(md_path: Path) -> Path:
    out = md_path.with_suffix(".pdf")
    pdf = Doc(format="A4")
    pdf.alias_nb_pages()
    pdf.set_margins(16, 16, 16)
    pdf.add_font("Body", "", str(FONT))
    pdf.add_font("BodyBold", "", str(FONT_BD if FONT_BD.exists() else FONT))
    render(pdf, clean_md(md_path.read_text(encoding="utf-8")))
    pdf.output(str(out))
    return out


def main() -> None:
    if not FONT.exists():
        raise SystemExit(f"Missing font: {FONT}")
    files = sorted(TPL.glob("*.md"))
    if not files:
        raise SystemExit(f"No markdown templates in {TPL}")
    for md in files:
        out = convert_one(md)
        print(f"wrote {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
