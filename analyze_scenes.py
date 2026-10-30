"""Finds candidate horizontal support surfaces in each scene image (long, strong vertical-gradient edges).
Writes tools/candidates.json (normalised image coords) + an overlay sheet for human/vision verification.
Usage: python3 tools/analyze_scenes.py [assets-dir]"""
import sys,json,numpy as np
from PIL import Image,ImageDraw
A=sys.argv[1] if len(sys.argv)>1 else 'assets';W,H=300,533
def cands(path):
    g=np.asarray(Image.open(path).convert('L').resize((W,H),Image.LANCZOS),dtype=np.float32)
    g=(g[:-2]+2*g[1:-1]+g[2:])[:, :]/4  # vertical smooth
    gy=np.abs(g[2:]-g[:-2]);gy=np.pad(gy,((1,1),(0,0)))
    thr=np.percentile(gy,90);out=[]
    for y in range(8,H-8):
        row=gy[y]>thr;x=0
        while x<W:
            if row[x]:
                s=x
                while x<W and (row[x] or (x+3<W and row[x:x+4].any())):x+=1
                if x-s>=W*.16:out.append({'y':y/H,'x0':s/W,'x1':x/W,'str':float(gy[y,s:x].mean())})
            x+=1
    # merge adjacent rows into one line per run
    out.sort(key=lambda c:(round(c['x0'],1),c['y']));m=[]
    for c in out:
        for k in m:
            if abs(k['y']-c['y'])<.012 and min(k['x1'],c['x1'])-max(k['x0'],c['x0'])>.1:
                if c['str']>k['str']:k.update(c)
                break
        else:m.append(dict(c))
    return sorted(m,key=lambda c:-c['str']*(c['x1']-c['x0']))[:14]
if __name__=='__main__':
    res={};tiles=[]
    for s in ['bedroom','study','garden','cabin']:
        c=cands(f'{A}/scene-{s}-day.webp');res[s]=c
        im=Image.open(f'{A}/scene-{s}-day.webp').convert('RGB').resize((W,H));d=ImageDraw.Draw(im)
        for i in range(1,10):d.line([(0,i*H/10),(8,i*H/10)],fill=(255,255,0));d.text((10,i*H/10-5),f'.{i}',fill=(255,255,0))
        for i,k in enumerate(c):
            col=[(255,60,60),(60,255,60),(80,160,255),(255,0,255),(0,255,255),(255,160,0)][i%6];yy=k['y']*H
            d.line([(k['x0']*W,yy),(k['x1']*W,yy)],fill=col,width=2);d.text((k['x0']*W+2,yy-10),str(i),fill=col)
        tiles.append(im)
    sheet=Image.new('RGB',(W*4,H));[sheet.paste(t,(i*W,0)) for i,t in enumerate(tiles)];sheet.save('/tmp/cand.png')
    json.dump(res,open('tools/candidates.json','w'),indent=1)
    for s,c in res.items():print(s,[(i,round(k['y'],3),round(k['x0'],2),round(k['x1'],2)) for i,k in enumerate(c)])
