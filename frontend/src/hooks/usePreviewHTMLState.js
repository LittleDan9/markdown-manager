import { useState } from 'react';

export default function usePreviewHTMLState() {
  const [previewHTML, setPreviewHTML] = useState("");
  // Add any future preview HTML logic here
  return { previewHTML, setPreviewHTML };
}
