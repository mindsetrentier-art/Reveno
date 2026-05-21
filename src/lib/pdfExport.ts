import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// Convert OKLCH values to standard rgb/rgba format
const oklchToRgb = (l: number, c: number, h: number, a: number = 1): string => {
  // Convert HUE from degrees to radians
  const hRad = (h * Math.PI) / 180;
  
  // OKLCH to OKLAB
  const L = l;
  const oklab_a = c * Math.cos(hRad);
  const oklab_b = c * Math.sin(hRad);
  
  // OKLAB to LMS
  const l_ = L + 0.3963377774 * oklab_a + 0.2158017574 * oklab_b;
  const m_ = L - 0.1055613458 * oklab_a - 0.0638541728 * oklab_b;
  const s_ = L - 0.0894841775 * oklab_a - 1.2914855480 * oklab_b;
  
  const l_cube = l_ * l_ * l_;
  const m_cube = m_ * m_ * m_;
  const s_cube = s_ * s_ * s_;
  
  // LMS to Linear RGB
  const rL = +4.0767416621 * l_cube - 3.3077115913 * m_cube + 0.2309699292 * s_cube;
  const gL = -1.2684380046 * l_cube + 2.6097574011 * m_cube - 0.3413193965 * s_cube;
  const bL = -0.0041960863 * l_cube - 0.7034186147 * m_cube + 1.7076216867 * s_cube;
  
  // Linear RGB to sRGB
  const toSRGB = (x: number) => {
    if (x <= 0.0031308) return 12.92 * x;
    return 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
  };
  
  const r = Math.max(0, Math.min(255, Math.round(toSRGB(rL) * 255)));
  const g = Math.max(0, Math.min(255, Math.round(toSRGB(gL) * 255)));
  const b = Math.max(0, Math.min(255, Math.round(toSRGB(bL) * 255)));
  
  if (a === 1) {
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
};

const replaceOklchInString = (str: string): string => {
  // Matches oklch(L C H) or oklch(L C H / A)
  return str.replace(/oklch\(([^)]+)\)/g, (match, p1) => {
    try {
      const parts = p1.trim().split(/[\s/]+/).filter(Boolean);
      if (parts.length < 3) return match;
      
      const lStr = parts[0];
      const cStr = parts[1];
      const hStr = parts[2];
      const aStr = parts[3] || '1';
      
      let l = parseFloat(lStr);
      if (lStr.includes('%')) {
        l = l / 100;
      }
      
      const c = parseFloat(cStr);
      const h = parseFloat(hStr);
      
      let a = parseFloat(aStr);
      if (aStr.includes('%')) {
        a = a / 100;
      }
      
      if (isNaN(l) || isNaN(c) || isNaN(h)) {
        return match;
      }
      
      return oklchToRgb(l, c, h, isNaN(a) ? 1 : a);
    } catch (err) {
      return match;
    }
  });
};

export const exportToPDF = async (elementId: string, filename: string) => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id ${elementId} not found.`);
    return;
  }

  try {
    // Add a temporary class to fix any overflow issues during capture
    const originalStyle = element.style.cssText;
    element.style.background = '#ffffff';
    element.style.width = '1200px'; // Force a fixed width for consistent rendering
    element.style.maxWidth = '1200px';

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 1200,
      onclone: (clonedDoc) => {
        // Find and replace oklch within all style tags in the cloned DOM
        const styles = clonedDoc.getElementsByTagName('style');
        for (let i = 0; i < styles.length; i++) {
          const style = styles[i];
          if (style.innerHTML) {
            style.innerHTML = replaceOklchInString(style.innerHTML);
          }
        }
        
        // Find and replace oklch in all elements with inline style cssText
        const allElements = clonedDoc.getElementsByTagName('*');
        for (let i = 0; i < allElements.length; i++) {
          const el = allElements[i] as HTMLElement;
          if (el.style && el.style.cssText) {
            el.style.cssText = replaceOklchInString(el.style.cssText);
          }
        }
      }
    });

    // Restore original styles
    element.style.cssText = originalStyle;

    const imgData = canvas.toDataURL('image/png');
    
    // A4 dimensions: 210 x 297 mm
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    let position = 0;
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Handle multiple pages if content is taller than one A4 page
    if (pdfHeight > pageHeight) {
      while (position < pdfHeight) {
        pdf.addImage(imgData, 'PNG', 0, -position, pdfWidth, pdfHeight);
        position += pageHeight;
        if (position < pdfHeight) {
          pdf.addPage();
        }
      }
    } else {
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    }

    pdf.save(`${filename}.pdf`);
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Erreur lors de la génération du PDF.');
  }
};
