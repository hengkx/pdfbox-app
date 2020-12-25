import { exec } from 'child_process';
import { basename, join } from 'path';
import glob from 'glob';
import sharp from 'sharp';

function execute(command: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const child = exec(command, (err) => {
      if (err) {
        return reject(err);
      }
      resolve(true);
    });

    child.on('error', reject);
  });
}

const prevCmd = `java -jar ${join(__dirname, '..', 'jar', 'pdfbox-app-2.0.22.jar')}`;

export function pdfMerge(source: string[], dest: string) {
  return execute(`${prevCmd} PDFMerger ${source.join(' ')} ${dest}`);
}

export async function imageMerge(source: string[], dest: string) {
  let imageData: any[] = [];
  let offsetY = 0;
  let maxWidth = 0;
  for (const item of source) {
    const { width, height } = await sharp(item).metadata();
    imageData.push({ width, height, offsetY, buffer: await sharp(item).toBuffer() });
    offsetY += height || 0;
    maxWidth = Math.max(width || 0, maxWidth);
  }
  const imageBase = sharp({
    create: {
      background: '#fff',
      channels: 4,
      height: offsetY,
      width: maxWidth,
    },
  });
  const res = await imageBase
    .composite(imageData.map((item) => ({ input: item.buffer, left: 0, top: item.offsetY })))
    .toFile(dest);
  return res;
}

function globPromise(pattern: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    glob(pattern, (err, files) => {
      if (err) {
        return reject(err);
      }
      resolve(files);
    });
  });
}

export async function pdfToImage(source: string, dest?: string) {
  await execute(`${prevCmd} PDFToImage ${source}`);
  const name = basename(source.toLowerCase(), '.pdf');
  const files = await globPromise(`${name}*.jpg`);
  if (dest) {
    await imageMerge(files, dest);
    return dest;
  }
  return files;
}
