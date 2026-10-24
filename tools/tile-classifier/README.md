# 牌面分類器

用自己副牌的相片訓練 `public/models/mahjong-tiles.onnx`。偵測模型負責找牌的位置，這個分類器負責認牌面。

```bash
python3 -m venv .venv && .venv/bin/pip install torch torchvision onnx onnxscript pillow numpy
# 在專案根目錄執行
.venv/bin/python tools/tile-classifier/train.py 128000   # 訓練（Apple 晶片用 mps，其他請改 train.py 內的 dev）
.venv/bin/python tools/tile-classifier/export.py          # 輸出到 public/models/
```

`train.py` 內的 `rows` 是相片 `own-mahjong-pictures/IMG_0372 Medium.jpeg` 中每排牌的位置（y0, y1, x0, 牌寬, 張數），
`LABELS` 是每格對應的牌。加相片時照樣加一組 `rows` 與 `src` 即可。類別最後一個 `bg` 代表「不是牌」。
