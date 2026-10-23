import { describe, expect, it } from 'vitest';
import { MODEL_CLASSES, NUM_ANCHORS, modelClassToTile, parseOutput, sortReadingOrder } from '../src/vision/postprocess';

function tensor(boxes: { cls: string; score: number; cx: number; cy: number; w: number; h: number }[]) {
  const data = new Float32Array(41 * NUM_ANCHORS);
  boxes.forEach((b, i) => {
    data[i] = b.cx;
    data[NUM_ANCHORS + i] = b.cy;
    data[2 * NUM_ANCHORS + i] = b.w;
    data[3 * NUM_ANCHORS + i] = b.h;
    data[(4 + MODEL_CLASSES.indexOf(b.cls)) * NUM_ANCHORS + i] = b.score;
  });
  return data;
}

describe('vision postprocess', () => {
  it('maps model classes to app tiles', () => {
    expect(modelClassToTile('5z')).toBe('7z'); // 白
    expect(modelClassToTile('7z')).toBe('5z'); // 中
    expect(modelClassToTile('6z')).toBe('6z');
    expect(modelClassToTile('0p')).toBe('5p');
    expect(modelClassToTile('3s')).toBe('3s');
  });

  it('applies threshold and NMS, then reads left to right', () => {
    const dets = parseOutput(
      tensor([
        { cls: '2m', score: 0.9, cx: 200, cy: 100, w: 40, h: 60 },
        { cls: '2m', score: 0.8, cx: 202, cy: 101, w: 40, h: 60 }, // 重疊
        { cls: '7z', score: 0.7, cx: 100, cy: 102, w: 40, h: 60 },
        { cls: '9s', score: 0.2, cx: 400, cy: 100, w: 40, h: 60 }, // 低分
      ]),
    );
    expect(sortReadingOrder(dets).map((d) => d.tile)).toEqual(['5z', '2m']);
  });
});
