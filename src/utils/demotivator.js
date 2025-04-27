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
    
    // Draw title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px Times New Roman';
    ctx.textAlign = 'center';
    ctx.fillText(
      title.toUpperCase(), 
      canvasWidth / 2, 
      padding + photoMargin + photoHeight + 40
    );
    
    // Draw text
    ctx.font = '20px Times New Roman';
    ctx.fillText(
      text, 
      canvasWidth / 2, 
      padding + photoMargin + photoHeight + 40 + 30
    );
    
    // Return the buffer
    return canvas.toBuffer();
  } catch (error) {
    console.error('Error generating demotivator image:', error);
    throw error;
  }
} 