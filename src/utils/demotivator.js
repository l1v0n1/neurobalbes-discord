import { createCanvas, loadImage } from 'canvas';
import fetch from 'node-fetch';

/**
 * Generates a demotivator image with the given photo, title and text
 * @param {string} imageUrl - URL of the image to use
 * @param {string} title - Title text for the demotivator
 * @param {string} text - Body text for the demotivator
 * @returns {Promise<Buffer>} - The generated image as a buffer
 */
export async function demotivatorImage(imageUrl, title, text) {
  try {
    // Fetch the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }
    
    const imageArrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(imageArrayBuffer);
    
    // Load the image
    const image = await loadImage(buffer);
    
    // Define canvas dimensions based on the image
    const padding = 50;
    const borderWidth = 2;
    const photoMargin = 20;
    const titleHeight = 60;
    const textHeight = 40;
    const bottomPadding = 40;
    
    // Calculate dimensions
    const photoWidth = Math.min(600, image.width);
    const photoHeight = Math.round((photoWidth / image.width) * image.height);
    
    const canvasWidth = photoWidth + (photoMargin * 2) + (padding * 2);
    const canvasHeight = photoHeight + photoMargin + padding + titleHeight + textHeight + bottomPadding;
    
    // Create canvas
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');
    
    // Draw background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // Draw photo border
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(
      padding - borderWidth, 
      padding - borderWidth, 
      photoWidth + (photoMargin * 2) + (borderWidth * 2), 
      photoHeight + (photoMargin * 2) + (borderWidth * 2)
    );
    
    // Draw photo background
    ctx.fillStyle = '#000000';
    ctx.fillRect(
      padding, 
      padding, 
      photoWidth + (photoMargin * 2), 
      photoHeight + (photoMargin * 2)
    );
    
    // Draw the image
    ctx.drawImage(
      image, 
      padding + photoMargin, 
      padding + photoMargin, 
      photoWidth, 
      photoHeight
    );
    
    // --- TEXT WRAPPING UTILS ---
    function wrapText(ctx, text, maxWidth, font) {
      ctx.font = font;
      const words = text.split(' ');
      let lines = [];
      let line = '';
      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && n > 0) {
          lines.push(line.trim());
          line = words[n] + ' ';
        } else {
          line = testLine;
        }
      }
      lines.push(line.trim());
      return lines;
    }

    // --- TITLE DRAW (with wrapping, динамическое позиционирование) ---
    ctx.fillStyle = '#ffffff';
    const titleFont = 'bold 32px Times New Roman';
    ctx.font = titleFont;
    ctx.textAlign = 'center';
    const titleLines = wrapText(ctx, title.toUpperCase(), canvasWidth - 80, titleFont);
    const titleLineHeight = 38;
    // Новый расчёт: titleStartY теперь всегда минимум на 30px ниже картинки + белый отступ
    const minTitleOffset = 60;
    const titleStartY = padding + photoMargin + photoHeight + minTitleOffset;
    titleLines.forEach((line, i) => {
      ctx.fillText(line, canvasWidth / 2, titleStartY + i * titleLineHeight);
    });

    // --- TEXT DRAW (with wrapping) ---
    const textFont = '20px Times New Roman';
    ctx.font = textFont;
    const textLines = wrapText(ctx, text, canvasWidth - 80, textFont);
    const textStartY = titleStartY + titleLines.length * titleLineHeight + 10;
    const textLineHeight = 27;
    textLines.forEach((line, i) => {
      ctx.fillText(line, canvasWidth / 2, textStartY + i * textLineHeight);
    });

    // Return the buffer
    return canvas.toBuffer();
  } catch (error) {
    console.error('Error generating demotivator image:', error);
    throw error;
  }
} 