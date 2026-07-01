#!/usr/bin/env python3
import json
import re
import sys

import pdfplumber


DATE_RE = re.compile(r"^\d{2}/\d{2}/\d{4}$")


def text_for(words):
    return " ".join(word["text"] for word in words).strip()


def words_between(words, start, end):
    return [word for word in words if word["x0"] >= start and word["x0"] < end]


emitted = 0
limit = None


def emit(record):
    global emitted
    if record and record.get("registrationNumber") and record.get("name"):
        print(json.dumps(record, ensure_ascii=False, separators=(",", ":")))
        emitted += 1
        if limit is not None and emitted >= limit:
            raise StopIteration


def main():
    global limit
    if len(sys.argv) not in (2, 3):
        raise SystemExit("Usage: parse-wa-builders.py <BuilderRegister.pdf> [limit]")
    if len(sys.argv) == 3:
        limit = int(sys.argv[2])

    current = None
    in_current_contractors = False

    try:
        with pdfplumber.open(sys.argv[1]) as pdf:
            for page_number, page in enumerate(pdf.pages, start=1):
                page_text = page.extract_text(x_tolerance=2, y_tolerance=3) or ""
                if "SECTION 1 - REGISTER OF CURRENT BUILDING CONTRACTORS" in page_text:
                    in_current_contractors = True
                if "SECTION 2 - REGISTER OF CURRENT BUILDING PRACTITIONERS" in page_text:
                    emit(current)
                    return
                if not in_current_contractors:
                    continue

                words = page.extract_words(x_tolerance=2, y_tolerance=3, keep_blank_chars=False)
                lines = {}
                for word in words:
                    top = round(word["top"], 1)
                    lines.setdefault(top, []).append(word)

                for top in sorted(lines):
                    line_words = sorted(lines[top], key=lambda item: item["x0"])
                    line_text = text_for(line_words)
                    if not line_text:
                        continue
                    if top < 245:
                        continue
                    first = line_words[0]["text"]
                    second = line_words[1]["text"] if len(line_words) > 1 else ""
                    is_record_start = first == "Current" and second.startswith("BC")

                    if is_record_start:
                        emit(current)
                        registered = text_for(words_between(line_words, 485, 545))
                        if not DATE_RE.match(registered):
                            registered = None
                        current = {
                            "status": "Current",
                            "registrationNumber": second,
                            "formerRegistrationNumber": text_for(words_between(line_words, 118, 160)) or None,
                            "name": text_for(words_between(line_words, 160, 353)),
                            "businessAddress": text_for(words_between(line_words, 353, 485)),
                            "registeredDate": registered,
                            "firstNominatedSupervisor": text_for([word for word in line_words if word["x0"] >= 545]),
                            "sourcePage": page_number,
                            "restrictions": [],
                        }
                        continue

                    if not current:
                        continue

                    if line_words[0]["x0"] >= 353 and line_words[0]["x0"] < 485:
                        continuation = text_for(words_between(line_words, 353, 485))
                        if continuation:
                            current["businessAddress"] = f"{current.get('businessAddress', '')} {continuation}".strip()
                    elif line_words[0]["x0"] >= 545:
                        continuation = text_for([word for word in line_words if word["x0"] >= 545])
                        if continuation:
                            current["firstNominatedSupervisor"] = f"{current.get('firstNominatedSupervisor', '')} {continuation}".strip()
                    elif line_text.startswith("Restricted to:") or current["restrictions"]:
                        current["restrictions"].append(line_text)

        emit(current)
    except StopIteration:
        return


if __name__ == "__main__":
    main()
