import { useCallback } from 'react';
import { saveAs } from 'file-saver';
import DocumentsApi from '../api/documentsApi';

export default function useExportDocuments(currentDocument, setLoading, setError) {
  const exportAsMarkdown = useCallback((content, filename) => {
    const name = filename || currentDocument.name || 'document';
    const fileName = name.endsWith('.md') ? name : `${name}.md`;
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    saveAs(blob, fileName);
  }, [currentDocument]);

  const exportAsPDF = useCallback(async (htmlContent, filename = null, theme = 'light') => {
    setLoading(true);
    setError('');
    try {
      const documentName = filename || currentDocument.name;
      const isDark = theme === 'dark';
      const pdfBlob = await DocumentsApi.exportAsPDF(htmlContent, documentName, isDark);
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = documentName.endsWith('.pdf') ? documentName : `${documentName}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setError('PDF export failed');
    } finally {
      setLoading(false);
    }
  }, [currentDocument]);

  const importMarkdownFile = useCallback(file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve({ content: e.target.result, name: file.name.replace(/\.md$/, '') });
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  }), []);

  return { exportAsMarkdown, exportAsPDF, importMarkdownFile };
}
