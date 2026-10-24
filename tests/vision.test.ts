import { describe, expect, it } from 'vitest';
import { CLASSIFIER_LABELS as LABELS } from '../src/vision/classify';
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

describe('多幀投票', () => {
  const det = (tile: string, x: number, score = 0.8) => ({ tile, score, x, y: 100, w: 40, h: 60 });
  it('同一位置取總分最高的牌，偶爾誤認不影響結果', async () => {
    const { voteDetections } = await import('../src/vision/postprocess');
    const frames = [
      [det('1m', 0), det('2m', 50)],
      [det('1m', 1), det('3m', 51, 0.5)],
      [det('1m', 0), det('2m', 50)],
    ];
    expect(voteDetections(frames).map((d) => d.tile)).toEqual(['1m', '2m']);
  });
  it('只出現一次的雜訊會被濾走', async () => {
    const { voteDetections } = await import('../src/vision/postprocess');
    const frames = [[det('1m', 0), det('9s', 300)], [det('1m', 0)], [det('1m', 0)]];
    expect(voteDetections(frames).map((d) => d.tile)).toEqual(['1m']);
  });
});

describe('分類器取捨', () => {
  const det = (tile: string, score: number) => ({ tile, score, x: 0, y: 0, w: 40, h: 60 });
  const logits = (label: string, strength: number) => {
    const CLASSIFIER_LABELS = LABELS;
    return CLASSIFIER_LABELS.map((l) => (l === label ? strength : 0));
  };
  it('分類器有把握便覆蓋偵測結果', async () => {
    const { decideTile } = await import('../src/vision/classify');
    expect(decideTile(logits('3z', 10), det('2z', 0.9))).toBe('3z');
  });
  it('分類器認為不是牌便丟棄', async () => {
    const { decideTile } = await import('../src/vision/classify');
    expect(decideTile(logits('bg', 10), det('2z', 0.9))).toBeUndefined();
  });
  it('分類器沒把握時，偵測分數高才保留', async () => {
    const { decideTile } = await import('../src/vision/classify');
    expect(decideTile(logits('3z', 0), det('2z', 0.9))).toBe('2z');
    expect(decideTile(logits('3z', 0), det('2z', 0.2))).toBeUndefined();
  });
});
