import express from 'express';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';

const router = express.Router();

// Helper to convert PPTX to PDF using LibreOffice
function convertPPTXtoPDF(pptxPath) {
  return new Promise((resolve, reject) => {
    const absPptxPath = path.resolve(pptxPath);
    const pptxDir = path.dirname(absPptxPath);
    const cmd = `soffice --headless --convert-to pdf --outdir "${pptxDir}" "${absPptxPath}"`;
    console.log('Running command:', cmd);
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || stdout || error.message));
      } else {
        const pptxBase = path.basename(absPptxPath, path.extname(absPptxPath));
        const files = fs.readdirSync(pptxDir);
        const pdfFile = files.find(f => f.startsWith(pptxBase) && f.endsWith('.pdf'));
        if (pdfFile) {
          resolve(path.join(pptxDir, pdfFile));
        } else {
          reject(new Error('PDF not created.'));
        }
      }
    });
  });
}

// POST /api/slides/process
// Expects: { files: ["/uploads/filename1", ...] }
router.post('/process', async (req, res) => {
  const { files } = req.body;
  if (!files || !Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: 'No files provided' });
  }

  let slides = [];
  try {
    for (const file of files) {
      const absPath = path.join(process.cwd(), file);
      if (file.endsWith('.pptx') || file.endsWith('.ppt')) {
        // Convert PPTX to PDF
        const pdfPath = await convertPPTXtoPDF(absPath);
        // Return the PDF URL for preview (replace .pptx/.ppt with .pdf in the original file path)
        const pdfUrl = file.replace(/\.(pptx|ppt)$/i, '.pdf');
        slides.push({
          id: slides.length + 1,
          pdf: pdfUrl,
          title: path.basename(pdfPath),
          text: 'PDF preview of uploaded PPTX'
        });
      } else {
        // For other files, just show as image/text
        slides.push({
          id: slides.length + 1,
          image: file,
          title: `Slide ${slides.length + 1}`,
          text: `Extracted text for slide ${slides.length + 1}`
        });
      }
    }
    res.json({ slides });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router; 