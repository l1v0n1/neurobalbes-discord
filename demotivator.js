const { createCanvas, loadImage } = require('canvas');
const bg = './assets/demotivator.png';

const imageProperties = {
  width: 714,
  height: 745
};

async function demotivatorImage(img, title, subtitle) {
  const canvas = createCanvas(imageProperties.width, imageProperties.height);
  const ctx = canvas.getContext('2d');
  ctx.font = '48px Times New Roman';

  const [image, avatar] = await Promise.all([loadImage(bg), loadImage(img.attachment)]);

  ctx.drawImage(image, 0, 0);
  ctx.drawImage(avatar, 46, 46, 622, 551);

  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.fillText(title, 345, 660);

  ctx.font = 'normal 40px Times New Roman';
  ctx.fillText(subtitle, 346, 710);

  const buffer = canvas.toBuffer('image/png');
  return buffer;
}

module.exports.demotivatorImage = demotivatorImage;
