# Removes other companies' logos (TV makers' names, the trainer brand) from the AI lookbook photos by
# inpainting, writing over the files in tools/lookbook. Already run; kept as a record of what changed.
# Needs: pip install opencv-python-headless     Run: python3 tools/retouch-lookbook.py
import cv2, numpy as np, os
L = OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lookbook') + os.sep
# (x0, y0, x1, y1, how far above the box's median brightness counts as logo, mode)
# mode "all": every bright pixel in the box. mode "enc": only bright marks that don't touch the box edge,
# so socks, soles and background that run out of the box are left alone.
SPOTS = {
  'look-01': [(x0, y0, x1, y1, 28, 'all') for (x0, y0, x1, y1) in [
      (250,346,308,368), (102,60,148,79), (108,344,154,362), (1308,236,1358,258), (1193,3,1242,22), (1178,329,1224,348),
      (120,716,158,736), (28,548,74,566), (1278,564,1340,583), (1268,939,1318,959), (1168,708,1212,726), (973,231,1012,248)]],
  'fit-01':  [(388,1138,420,1178,22,'all'), (541,1138,573,1178,22,'all'), (366,1102,394,1124,22,'enc'), (568,1103,585,1120,22,'enc')],
  'fit-02':  [(408,1166,427,1196,40,'all'), (509,1158,541,1200,22,'enc'), (383,1130,404,1146,30,'enc'), (538,1128,570,1146,30,'enc')],
}
for name, spots in SPOTS.items():
    img = cv2.imread(L + name + '.png')
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(int)
    mask = np.zeros(g.shape, np.uint8)
    for (x0, y0, x1, y1, t, mode) in spots:
        box = g[y0:y1, x0:x1]
        sub = (box > np.median(box) + t).astype(np.uint8)
        if mode == 'enc':
            n, lab, st, _ = cv2.connectedComponentsWithStats(sub, connectivity=8)
            keep = np.zeros_like(sub)
            H, W = sub.shape
            for i in range(1, n):
                x, y, w, h, _ = st[i]
                if x > 0 and y > 0 and x + w < W and y + h < H: keep[lab == i] = 1
            sub = keep
        mask[y0:y1, x0:x1] = np.maximum(mask[y0:y1, x0:x1], sub * 255)
    mask = cv2.dilate(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    cv2.imwrite(OUT + name + '.png', cv2.inpaint(img, mask, 6, cv2.INPAINT_TELEA))
    print(name, int(mask.sum() / 255), 'px retouched')
