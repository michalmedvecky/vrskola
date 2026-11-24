# Trénink rozpoznávání psaných číslic pro Dukáty a dostihy (web/dostihy/cislice-model.json).
#   pip install torch numpy pillow
#   stáhnout MNIST (train/t10k *-ubyte.gz) do ./mnist/, pak:
#   python3 nastroje/dostihy-cislice-synt.py     (české jedničky a sedmičky → synt.npz)
#   python3 nastroje/dostihy-cislice-trenink.py 15  (→ cislice-model.json, zkopírovat do web/dostihy/)
import gzip, numpy as np, torch, torch.nn as nn, torch.nn.functional as F, json, base64, math, sys, time
torch.manual_seed(1); np.random.seed(1)
import os
D=os.environ.get('MNIST','./mnist/')  # složka se soubory MNIST *.gz
def img(f): return np.frombuffer(gzip.open(D+f).read(),np.uint8,offset=16).reshape(-1,1,28,28).astype(np.float32)/255
def lab(f): return np.frombuffer(gzip.open(D+f).read(),np.uint8,offset=8).astype(np.int64)
Xtr,Ytr=torch.tensor(img('train-images-idx3-ubyte.gz')),torch.tensor(lab('train-labels-idx1-ubyte.gz'))
S=np.load('./synt.npz'); Xtr=torch.cat([Xtr,torch.tensor(S['X'])]); Ytr=torch.cat([Ytr,torch.tensor(S['Y'])])
NTR=len(Xtr)
Xte,Yte=torch.tensor(img('t10k-images-idx3-ubyte.gz')),torch.tensor(lab('t10k-labels-idx1-ubyte.gz'))
class Net(nn.Module):
    def __init__(s):
        super().__init__()
        s.c1=nn.Conv2d(1,16,3,padding=1); s.c2=nn.Conv2d(16,32,3,padding=1); s.f1=nn.Linear(32*7*7,64); s.f2=nn.Linear(64,10)
    def forward(s,x,feat=False):
        x=F.max_pool2d(F.relu(s.c1(x)),2); x=F.max_pool2d(F.relu(s.c2(x)),2)
        h=F.relu(s.f1(x.flatten(1)))
        if feat: return h
        return s.f2(F.dropout(h,0.3,s.training))
def aug(x):
    n=x.shape[0]
    a=(torch.rand(n)-.5)*2*math.radians(14); sh=(torch.rand(n)-.5)*0.5
    sc=0.85+torch.rand(n)*0.3; asp=1+(torch.rand(n)-.5)*0.3
    tx=(torch.rand(n)-.5)*0.16; ty=(torch.rand(n)-.5)*0.16
    c,s_=torch.cos(a),torch.sin(a)
    th=torch.zeros(n,2,3)
    th[:,0,0]=c/sc*asp; th[:,0,1]=(-s_+sh)/sc; th[:,1,0]=s_/sc; th[:,1,1]=c/sc/asp; th[:,0,2]=tx; th[:,1,2]=ty
    x=F.grid_sample(x,F.affine_grid(th,x.shape,align_corners=False),align_corners=False)
    r=torch.rand(n)
    dil=F.max_pool2d(x,3,1,1); ero=-F.max_pool2d(-x,3,1,1)
    x=torch.where((r<.25).view(-1,1,1,1),dil*0.8+x*0.2,x)
    x=torch.where((r>.85).view(-1,1,1,1),torch.maximum(ero,x*0.6),x)
    # rozostření a kontrast jako u kreslení na plátno
    x=x.clamp(0,1)
    return x
net=Net(); opt=torch.optim.Adam(net.parameters(),2e-3)
E=int(sys.argv[1]) if len(sys.argv)>1 else 10
sched=torch.optim.lr_scheduler.OneCycleLR(opt,4e-3,total_steps=E*(NTR//128+1))
for ep in range(E):
    net.train(); p=torch.randperm(NTR); t=time.time()
    for i in range(0,NTR,128):
        b=p[i:i+128]; x=aug(Xtr[b])
        loss=F.cross_entropy(net(x),Ytr[b],label_smoothing=0.05)
        opt.zero_grad(); loss.backward(); opt.step(); sched.step()
    net.eval()
    with torch.no_grad():
        acc=(net(Xte).argmax(1)==Yte).float().mean().item(); acca=(net(aug(Xte)).argmax(1)==Yte).float().mean().item()
    print(ep,round(acc,4),round(acca,4),round(time.time()-t),flush=True)
    with torch.no_grad():
        Xs=torch.tensor(S['X'][::7]); print('  synt',(net(Xs).argmax(1)==torch.tensor(S['Y'][::7])).float().mean().item())
torch.save(net.state_dict(),'./net.pt')
# export int8
out=[]
for k,v in net.state_dict().items():
    a=v.numpy().astype(np.float32); s=float(np.abs(a).max()/127) or 1
    q=np.round(a/s).clip(-127,127).astype(np.int8)
    out.append({'nazev':k,'tvar':list(a.shape),'meritko':s,'data':base64.b64encode(q.tobytes()).decode()})
json.dump({'popis':'Rozpoznávání psaných číslic: malá konvoluční síť natrénovaná na MNIST (int8)','vrstvy':out},open('./cislice-model.json','w'))
# kontrola kvantizace
sd={o['nazev']:torch.tensor(np.frombuffer(base64.b64decode(o['data']),np.int8).astype(np.float32).reshape(o['tvar'])*o['meritko']) for o in out}
net.load_state_dict(sd); net.eval()
with torch.no_grad(): print('int8', (net(Xte).argmax(1)==Yte).float().mean().item())
