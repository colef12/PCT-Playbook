"""Extract the 17 MTV sector figures from the PCT 7110.65H CHG 1 (redacted) PDF.

Raster figures: the embedded image. Vector figures (OJAAY North, ENSUE North): page rendered at
300 dpi and cropped to the range-ring extent. Writes <figdir>/img/<fig>.png and <figdir>/pages.json.
"""
import json, os, sys
import numpy as np, cv2, pymupdf
from common import masks

def main(pdf, figdir):
    here = os.path.dirname(os.path.abspath(__file__))
    pages = json.load(open(f'{here}/pages.json'))           # figure -> PDF page (1-based)
    os.makedirs(f'{figdir}/img', exist_ok=True)
    json.dump(pages, open(f'{figdir}/pages.json', 'w'))
    d = pymupdf.open(pdf)
    for k, p in pages.items():
        pg = d[p - 1]; ims = pg.get_images(full=True)
        if ims:
            pix = pymupdf.Pixmap(d, ims[0][0])
            if pix.n > 3: pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
            pix.save(f'{figdir}/img/{k}.png')
        else:
            pix = pg.get_pixmap(dpi=300); pix.save(f'{figdir}/img/{k}.png')
            im = cv2.imread(f'{figdir}/img/{k}.png'); _, _, g = masks(im)
            ys, xs = np.nonzero(g)
            x0, x1, y0, y1 = [int(np.percentile(a, q)) for a, q in ((xs, .2), (xs, 99.8), (ys, .2), (ys, 99.8))]
            cv2.imwrite(f'{figdir}/img/{k}.png', im[max(0, y0 - 4):y1 + 4, max(0, x0 - 4):x1 + 4])
        print(k, p)

if __name__ == '__main__':
    main(*sys.argv[1:3])
