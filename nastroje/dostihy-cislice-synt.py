# Syntetické číslice nakreslené jako tahy tužkou (stejné vykreslení jako cislice.js),
# hlavně česká jednička s náběhem a sedmička s čárkou, které v MNIST skoro nejsou.
import numpy as np, math
from PIL import Image, ImageDraw
R=np.random.default_rng(7)
def vykresli(tahy, sirka):
    pts=np.concatenate(tahy); x0,y0=pts.min(0); x1,y1=pts.max(0); w,h=x1-x0,y1-y0; vel=max(w,h,1e-6)
    S=4;N=112;k=20*S/vel; ox=(N-w*k)/2; oy=(N-h*k)/2
    im=Image.new('L',(N,N),0); d=ImageDraw.Draw(im); lw=sirka*S
    for t in tahy:
        q=[(ox+(x-x0)*k,oy+(y-y0)*k) for x,y in t]
        d.line(q,fill=255,width=int(round(lw)),joint='curve')
        for x,y in (q[0],q[-1]): d.ellipse([x-lw/2,y-lw/2,x+lw/2,y+lw/2],fill=255)
    a=np.asarray(im,np.float32).reshape(28,4,28,4).mean((1,3))/255
    ys,xs=np.mgrid[0:28,0:28]; m=a.sum(); dx=int(round(13.5-(xs*a).sum()/m)); dy=int(round(13.5-(ys*a).sum()/m))
    out=np.zeros_like(a)
    sy=slice(max(0,dy),min(28,28+dy)); sx=slice(max(0,dx),min(28,28+dx))
    out[sy,sx]=a[max(0,-dy):28-max(0,dy), max(0,-dx):28-max(0,dx)]
    return np.clip(out,0,1)
def hladce(body,n=10,sum_=0.02):
    out=[]
    for a,b in zip(body[:-1],body[1:]):
        for f in np.linspace(0,1,n,endpoint=False): out.append(np.array(a)+(np.array(b)-np.array(a))*f+R.normal(0,sum_,2))
    out.append(np.array(body[-1])); return np.array(out)
def transform(tahy):
    rot=R.normal(0,.12); sh=R.normal(0,.15); sx=R.uniform(.8,1.2)
    M=np.array([[math.cos(rot),-math.sin(rot)],[math.sin(rot),math.cos(rot)]])@np.array([[sx,sh],[0,1]])
    return [t@M.T for t in tahy]
def jednicka():
    top=(R.uniform(.45,.65),0); dole=(top[0]+R.normal(0,.04),1)
    L=R.uniform(.12,.38); ang=math.radians(R.uniform(25,65))
    nab=(top[0]-L*math.cos(ang), top[1]+L*math.sin(ang))
    tahy=[[nab,top,dole]] if R.random()<.8 else [[nab,top],[top,dole]]
    if R.random()<.12: tahy.append([(dole[0]-.2,1),(dole[0]+.2,1)])  # patka
    return tahy
def sedmicka():
    l=(R.uniform(.05,.25),R.uniform(0,.08)); p=(R.uniform(.75,.95),R.uniform(0,.06)); d=(R.uniform(.3,.55),1)
    stred=((p[0]+d[0])/2+R.normal(0,.05),.5)
    t=[[l,p,stred,d]]
    if R.random()<.5: y=R.uniform(.45,.6); xm=p[0]+(d[0]-p[0])*y; t.append([(xm-R.uniform(.15,.3),y),(xm+R.uniform(.1,.25),y)])
    if R.random()<.3: t[0]=[(l[0],l[1]+R.uniform(.05,.15))]+t[0]  # malý náběh
    return t
def generuj(fn,cis,n):
    X=np.zeros((n,1,28,28),np.float32)
    for i in range(n):
        tahy=transform([hladce(t) for t in fn()]); X[i,0]=vykresli(tahy,R.uniform(1.9,3.3))
    return X,np.full(n,cis,np.int64)
if __name__=='__main__':
    X1,Y1=generuj(jednicka,1,8000); X7,Y7=generuj(sedmicka,7,5000)
    np.savez_compressed('./synt.npz',X=np.concatenate([X1,X7]),Y=np.concatenate([Y1,Y7]))
    Image.fromarray((np.concatenate([np.concatenate(list(X1[:12,0]),1),np.concatenate(list(X7[:12,0]),1)],0)*255).astype(np.uint8)).resize((672,112)).save('./synt.png')
