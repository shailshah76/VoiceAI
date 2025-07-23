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

// Helper to convert PDF pages to images using pdftoppm directly
function convertPDFToImages(pdfPath) {
  return new Promise((resolve, reject) => {
    const outputDir = path.dirname(pdfPath);
    const pdfBaseName = path.basename(pdfPath, '.pdf');
    
    console.log('Converting PDF to images:', pdfPath);
    console.log('Output directory:', outputDir);
    
    // Use pdftoppm directly - more reliable than pdf-poppler
    const cmd = `pdftoppm -jpeg -r 150 "${pdfPath}" "${outputDir}/${pdfBaseName}-page"`;
    console.log('Running pdftoppm command:', cmd);
    
    exec(cmd, { timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        console.error('pdftoppm error:', error);
        // Fallback: return the original PDF as a single slide
        resolve([{
          pageNumber: 1,
          imagePath: `/uploads/${path.basename(pdfPath)}`
        }]);
        return;
      }
      
      console.log('pdftoppm completed successfully');
      
      // Find generated image files
      try {
        const files = fs.readdirSync(outputDir);
        const imageFiles = files.filter(f => f.startsWith(`${pdfBaseName}-page`) && f.endsWith('.jpg'));
        
        if (imageFiles.length === 0) {
          console.log('No image files generated, using PDF fallback');
          resolve([{
            pageNumber: 1,
            imagePath: `/uploads/${path.basename(pdfPath)}`
          }]);
          return;
        }
        
        // Sort by page number
        imageFiles.sort((a, b) => {
          const aNum = parseInt(a.match(/-(\d+)\.jpg$/)?.[1] || '1');
          const bNum = parseInt(b.match(/-(\d+)\.jpg$/)?.[1] || '1');
          return aNum - bNum;
        });
        
        console.log('Generated image files:', imageFiles);
        
        const pages = imageFiles.map((file, index) => ({
          pageNumber: index + 1,
          imagePath: `/uploads/${file}`
        }));
        
        resolve(pages);
      } catch (err) {
        console.error('Error reading generated files:', err);
        resolve([{
          pageNumber: 1,
          imagePath: `/uploads/${path.basename(pdfPath)}`
        }]);
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
        // Convert PDF pages to images
        const pageImages = await convertPDFToImages(pdfPath);
        
        // Create a slide for each page
        pageImages.forEach((page, index) => {
          slides.push({
            id: slides.length + 1,
            image: page.imagePath,
            title: `Slide ${index + 1}`,
            text: `Page ${page.pageNumber} of presentation`,
            pageNumber: page.pageNumber,
            totalPages: pageImages.length
          });
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