import random, numpy as np, torch, torch.nn as nn, torch.nn.functional as F, sys
from PIL import Image
import torchvision.transforms.v2 as T
torch.manual_seed(0); random.seed(0)
LABELS=['1z','2z','3z','4z','6z','5z','7z']+[f'{n}m' for n in range(1,10)]+[f'{n}s' for n in range(1,10)]+[f'{n}p' for n in range(1,10)]+['bg']
rows=[(166,220,123,39.5,7),(218,268,59.5,40,9),(266,322,59.5,40,9),(320,376,59.5,40,9)]
cells=[(x0+i*p,y0,p,y1-y0) for y0,y1,x0,p,n in rows for i in range(n)]
src=Image.open('own-mahjong-pictures/IMG_0372 Medium.jpeg').convert('RGB')
OW,OH=32,44; M=0.45; UP=3
def context(c):
    x,y,w,h=c; box=(x-w*M,y-h*M,x+w*(1+M),y+h*(1+M))
    im=src.crop(tuple(round(v) for v in box)); return im.resize((im.width*UP,im.height*UP),Image.BICUBIC)
ctxs=[context(c) for c in cells]
to_t=T.Compose([T.ToImage(),T.ToDtype(torch.float32,scale=True)])
ctx_t=[to_t(c) for c in ctxs]
# background crops: felt / floor / shoes regions and half-tile slices
bgregions=[(0,0,480,150),(0,385,480,640)]
def bg_sample():
    r=random.random()
    if r<0.7:
        x0,y0,x1,y1=random.choice(bgregions); w=random.randint(30,60); h=int(w*1.35)
        x=random.randint(x0,x1-w); y=random.randint(y0,y1-h); return src.crop((x,y,x+w,y+h)).resize((OW,OH))
    # tile straddling gap / partial tile
    c=random.choice(cells); dx=random.uniform(.4,.7)*random.choice([-1,1]); dy=random.uniform(-.1,.1)
    x,y,w,h=c; x+=dx*w; y+=dy*h
    return src.crop((round(x),round(y),round(x+w),round(y+h))).resize((OW,OH))
def make_aug(strong=False):
    s=1.4 if strong else 1.0
    return T.Compose([
        T.RandomApply([T.RandomPerspective(0.25*s,p=1.0)],p=.7),
        T.RandomAffine(degrees=10*s,translate=(.06,.06),scale=(.85,1.18),shear=6),
        T.ColorJitter(.45*s,.45*s,.4*s,.04),
        T.RandomApply([T.GaussianBlur(5,(.3,1.8*s))],p=.4),
    ])
aug=make_aug(); aug_strong=make_aug(True)
def sample(cls,a):
    if cls==34: im=to_t(bg_sample()); im=T.ColorJitter(.4,.4,.3,.03)(im); return im
    t=a(ctx_t[cls]); _,H,W=t.shape
    # crop window around center = cell with jitter
    cw=W/(1+2*M); ch=H/(1+2*M)
    s=random.uniform(.9,1.12); cw*=s*random.uniform(.95,1.05); ch*=s*random.uniform(.95,1.05)
    cx=W/2+random.uniform(-.07,.07)*cw; cy=H/2+random.uniform(-.07,.07)*ch
    x0=int(max(0,cx-cw/2));x1=int(min(W,cx+cw/2));y0=int(max(0,cy-ch/2));y1=int(min(H,cy+ch/2))
    t=t[:,y0:y1,x0:x1][None]
    if random.random()<.5: # low-res simulation
        f=random.uniform(.2,.6); t=F.interpolate(t,scale_factor=f,mode='bilinear',antialias=True)
    t=F.interpolate(t,size=(OH,OW),mode='bilinear',antialias=True)[0]
    t=t+torch.randn_like(t)*random.uniform(0,.03)
    return t.clamp(0,1)
class DS(torch.utils.data.Dataset):
    def __init__(s,n,a): s.n=n;s.a=a
    def __len__(s): return s.n
    def __getitem__(s,i):
        c=random.randint(0,34) if random.random()<.06 else random.randint(0,33)
        return sample(c,s.a),c
def block(i,o): return nn.Sequential(nn.Conv2d(i,o,3,padding=1,bias=False),nn.BatchNorm2d(o),nn.ReLU(),nn.Conv2d(o,o,3,padding=1,bias=False),nn.BatchNorm2d(o),nn.ReLU(),nn.MaxPool2d(2))
net=nn.Sequential(block(3,24),block(24,48),block(48,96),nn.Conv2d(96,128,3,padding=1),nn.ReLU(),nn.AdaptiveAvgPool2d(1),nn.Flatten(),nn.Dropout(.2),nn.Linear(128,35))
dev='mps'; net.to(dev)
if __name__=='__main__':
    dl=torch.utils.data.DataLoader(DS(int(sys.argv[1]),aug),batch_size=128,num_workers=6,persistent_workers=True)
    opt=torch.optim.AdamW(net.parameters(),2e-3,weight_decay=1e-3)
    steps=len(dl); sched=torch.optim.lr_scheduler.OneCycleLR(opt,3e-3,total_steps=steps)
    net.train()
    for i,(x,y) in enumerate(dl):
        x,y=x.to(dev),y.to(dev); loss=F.cross_entropy(net(x),y,label_smoothing=.05)
        opt.zero_grad();loss.backward();opt.step();sched.step()
        if i%100==0: print(i,steps,round(loss.item(),3),flush=True)
    net.eval()
    # held-out style eval with stronger aug
    random.seed(99); torch.manual_seed(99)
    ok=tot=0;errs={}
    with torch.no_grad():
        for _ in range(40):
            for c in range(34):
                x=sample(c,aug_strong)[None].to(dev); p=net(x).argmax(1).item(); tot+=1; ok+=p==c
                if p!=c: errs[(LABELS[c],LABELS[p])]=errs.get((LABELS[c],LABELS[p]),0)+1
    print('strong-aug acc',ok/tot, sorted(errs.items(),key=lambda t:-t[1])[:10])
    torch.save(net.state_dict(),'tools/tile-classifier/net.pt')
