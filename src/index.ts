import fs from 'fs-extra';
import { exec } from 'child_process';
import { basename, join } from 'path';
import glob from 'glob';
import sharp, { Sharp } from 'sharp';

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
  if (source.length > 1) {
    return execute(`${prevCmd} PDFMerger ${source.join(' ')} ${dest}`);
  }
  if (source.length === 1) {
    return fs.copyFileSync(source[0], dest);
  }
}

export async function imageMerge(source: string[]): Promise<Sharp> {
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
  return imageBase.composite(
    imageData.map((item) => ({ input: item.buffer, left: 0, top: item.offsetY })),
  );
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

export async function pdfToImage(source: string | string[]): Promise<Sharp> {
  let pdfFile = '';
  if (Array.isArray(source)) {
    pdfFile = `temp${Date.now()}.pdf`;
    await pdfMerge(source, pdfFile);
  } else {
    pdfFile = source;
  }
  await execute(`${prevCmd} PDFToImage ${pdfFile}`);
  const name = basename(pdfFile.toLowerCase(), '.pdf');
  const files = await globPromise(join(pdfFile, '..', `${name}*.jpg`));
  const res = await imageMerge(files);
  files.forEach((item) => fs.removeSync(item));
  if (Array.isArray(source)) {
    fs.removeSync(pdfFile);
  }
  return res;
}
