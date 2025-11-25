"""PDF content preprocessing utilities for better page breaks."""
from typing import Any

from bs4 import BeautifulSoup


class PDFContentProcessor:
    """Processes HTML content to add semantic structure for better PDF page breaks."""

    @staticmethod
    def enhance_content_structure(html_content: str) -> str:
        """Add semantic CSS classes to HTML content for better page breaking."""
        soup = BeautifulSoup(html_content, "html.parser")

        # Add content grouping for headers and their following content
        PDFContentProcessor._group_headers_with_content(soup)

        # Add container classes for better break control
        PDFContentProcessor._add_container_classes(soup)

        # Enhance table structure
        PDFContentProcessor._enhance_table_structure(soup)

        # Add section breaks for long documents
        PDFContentProcessor._add_section_breaks(soup)

        return str(soup)

    @staticmethod
    def _group_headers_with_content(soup: BeautifulSoup) -> None:
        """Group headers with their immediately following content - SAFE VERSION."""
        headers = soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6"])

        for header in headers:
            # Check if it's actually a tag element (not text)
            if hasattr(header, "name") and header.name:
                # Only add a class to the header itself for CSS targeting
                # Don't move content around to avoid corruption
                current_classes = header.get("class", [])
                if "header-with-content" not in current_classes:
                    current_classes.append("header-with-content")
                    header["class"] = current_classes

    @staticmethod
    def _add_container_classes(soup: BeautifulSoup) -> None:
        """Add appropriate container classes to elements."""
        PDFContentProcessor._wrap_code_blocks(soup)
        PDFContentProcessor._wrap_tables(soup)
        PDFContentProcessor._wrap_lists(soup)
        PDFContentProcessor._enhance_blockquotes(soup)
        PDFContentProcessor._enhance_mermaid_diagrams(soup)

    @staticmethod
    def _wrap_code_blocks(soup: BeautifulSoup) -> None:
        """Add container classes to code blocks."""
        code_blocks = soup.find_all("pre")
        for block in code_blocks:
            if hasattr(block, "name") and block.name:
                current_classes = block.get("class", [])
                if "code-container" not in current_classes:
                    current_classes.append("code-container")
                    block["class"] = current_classes

    @staticmethod
    def _wrap_tables(soup: BeautifulSoup) -> None:
        """Wrap tables in container divs."""
        tables = soup.find_all("table")
        for table in tables:
            if hasattr(table, "name") and table.name:
                # Check if already wrapped
                parent = table.parent
                if parent and hasattr(parent, "get"):
                    parent_classes = parent.get("class", [])
                    if "table-container" not in parent_classes:
                        wrapper = soup.new_tag("div", **{"class": "table-container"})
                        table.insert_before(wrapper)
                        wrapper.append(table.extract())
                else:
                    wrapper = soup.new_tag("div", **{"class": "table-container"})
                    table.insert_before(wrapper)
                    wrapper.append(table.extract())

    @staticmethod
    def _wrap_lists(soup: BeautifulSoup) -> None:
        """Wrap lists in container divs."""
        lists = soup.find_all(["ul", "ol"])
        for list_elem in lists:
            if hasattr(list_elem, "name") and list_elem.name:
                # Skip nested lists
                if (
                    list_elem.parent
                    and hasattr(list_elem.parent, "name")
                    and list_elem.parent.name == "li"
                ):
                    continue
                # Check if already wrapped
                parent = list_elem.parent
                if parent and hasattr(parent, "get"):
                    parent_classes = parent.get("class", [])
                    if "list-container" not in parent_classes:
                        wrapper = soup.new_tag("div", **{"class": "list-container"})
                        list_elem.insert_before(wrapper)
                        wrapper.append(list_elem.extract())
                else:
                    wrapper = soup.new_tag("div", **{"class": "list-container"})
                    list_elem.insert_before(wrapper)
                    wrapper.append(list_elem.extract())

    @staticmethod
    def _enhance_blockquotes(soup: BeautifulSoup) -> None:
        """Add container classes to blockquotes."""
        blockquotes = soup.find_all("blockquote")
        for blockquote in blockquotes:
            if not blockquote.get("class"):
                blockquote["class"] = ["quote-container"]
            else:
                blockquote["class"].append("quote-container")

    @staticmethod
    def _enhance_mermaid_diagrams(soup: BeautifulSoup) -> None:
        """Add container classes to mermaid diagrams."""
        mermaid_diagrams = soup.find_all(class_="mermaid")
        for diagram in mermaid_diagrams:
            if not diagram.get("class"):
                diagram["class"] = ["mermaid", "diagram-container"]
            else:
                diagram["class"].append("diagram-container")

    @staticmethod
    def _enhance_table_structure(soup: BeautifulSoup) -> None:
        """Enhance table structure for better page breaking."""
        tables = soup.find_all("table")

        for table in tables:
            # Ensure table has proper thead/tbody structure
            headers = table.find_all("tr")
            if headers:
                first_row = headers[0]
                # Check if first row contains th elements
                if first_row.find_all("th"):
                    # Wrap in thead if not already
                    if not first_row.parent or first_row.parent.name != "thead":
                        thead = soup.new_tag("thead")
                        first_row.insert_before(thead)
                        thead.append(first_row.extract())

                    # Wrap remaining rows in tbody if needed
                    remaining_rows = table.find_all("tr")
                    if remaining_rows and not remaining_rows[0].parent.name == "tbody":
                        tbody = soup.new_tag("tbody")
                        table.append(tbody)
                        for row in remaining_rows:
                            tbody.append(row.extract())

    @staticmethod
    def _add_section_breaks(soup: BeautifulSoup) -> None:
        """Add section breaks for better document structure."""
        h1_headers = soup.find_all("h1")

        # Add soft section breaks before major headings (except the first)
        for i, header in enumerate(h1_headers):
            if i > 0:  # Skip the first h1
                section_break = soup.new_tag("div", **{"class": "section-break-auto"})
                header.insert_before(section_break)

        # Add breaks before major content blocks in long documents
        content_blocks = soup.find_all(["table", "pre", "blockquote"])
        if len(content_blocks) > 5:  # Only for longer documents
            for block in content_blocks[
                2::3
            ]:  # Every third block starting from the third
                section_break = soup.new_tag("div", **{"class": "section-break-auto"})
                block.insert_before(section_break)

    @staticmethod
    def get_document_stats(html_content: str) -> dict[str, Any]:
        """Get statistics about the document for optimization decisions."""
        soup = BeautifulSoup(html_content, "html.parser")

        stats = {
            "headers": {
                "h1": len(soup.find_all("h1")),
                "h2": len(soup.find_all("h2")),
                "h3": len(soup.find_all("h3")),
                "h4": len(soup.find_all("h4")),
                "h5": len(soup.find_all("h5")),
                "h6": len(soup.find_all("h6")),
            },
            "content_blocks": {
                "paragraphs": len(soup.find_all("p")),
                "lists": len(soup.find_all(["ul", "ol"])),
                "tables": len(soup.find_all("table")),
                "code_blocks": len(soup.find_all("pre")),
                "blockquotes": len(soup.find_all("blockquote")),
                "mermaid_diagrams": len(soup.find_all(class_="mermaid")),
            },
            "estimated_pages": PDFContentProcessor._estimate_page_count(soup),
            "complexity": PDFContentProcessor._assess_complexity(soup),
        }

        return stats

    @staticmethod
    def _estimate_page_count(soup: BeautifulSoup) -> int:
        """Rough estimation of page count based on content."""
        text_content = soup.get_text()

        # Rough estimates (very approximate)
        words_per_page = 400
        lines_per_page = 50

        word_count = len(text_content.split())
        line_count = len(text_content.split("\n"))

        # Factor in special content
        tables = len(soup.find_all("table"))
        code_blocks = len(soup.find_all("pre"))
        diagrams = len(soup.find_all(class_="mermaid"))

        # Each table/code block/diagram roughly equivalent to 1/4 page
        special_content_pages = (tables + code_blocks + diagrams) * 0.25

        text_pages = max(word_count / words_per_page, line_count / lines_per_page)

        return max(1, int(text_pages + special_content_pages))

    @staticmethod
    def _assess_complexity(soup: BeautifulSoup) -> str:
        """Assess document complexity for optimization decisions."""
        total_elements = len(soup.find_all())
        special_elements = len(soup.find_all(["table", "pre", "svg"])) + len(
            soup.find_all(class_="mermaid")
        )

        if total_elements > 1000 or special_elements > 20:
            return "high"
        elif total_elements > 300 or special_elements > 10:
            return "medium"
        else:
            return "low"
