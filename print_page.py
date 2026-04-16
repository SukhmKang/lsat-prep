import pymupdf  # PyMuPDF

pdf_path = "LSAT-Critical-Reasoning-Book.pdf"
page_number = 84  # 1-indexed

doc = pymupdf.open(pdf_path)
page = doc[page_number - 1]
print(page.get_text())
