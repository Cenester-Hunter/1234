import numpy as np, glob, fbx, rig
A='/mnt/user-data/attachments/bd9e1e1d-79a1-5211-bf90-f5cc6d5ba4bc/'
TICK=46186158000.0
MX={'HandEnd':'HandMiddle1','ToeEnd':'Toe_End','HeadTop':'HeadTop_End'}
def mxname(n):
    for k,v in MX.items():
        if n.endswith(k): return 'mixamorig:'+n[:-len(k)]+v
    return 'mixamorig:'+n
class Clip:
    def __init__(s,path):
        m,par,cu,no=fbx.load(path); s.models=m; s.parent=par
        s.byname={v['name']:k for k,v in m.items()}
        s.curves={}      # (model_id,'Lcl Rotation') -> [3 curves]
        for nid,nd in no.items():
            if 'model' not in nd: continue
            s.curves[(nd['model'],nd['prop'])]={ax:cu[c] for ax,c in nd['curves'].items()}
        ts=[c['t'][-1] for v in s.curves.values() for c in v.values()]
        s.dur=max(ts)/TICK
    def val(s,mid,prop,t):
        base=s.models[mid]['props'].get(prop,[0,0,0] if prop!='Lcl Scaling' else [1,1,1])[:3]
        cv=s.curves.get((mid,prop))
        out=list(base)
        if cv:
            for i,ax in enumerate(['d|X','d|Y','d|Z']):
                if ax in cv: out[i]=float(np.interp(t*TICK,cv[ax]['t'],cv[ax]['v']))
        return np.array(out,float)
    def fk(s,t):
        pos={};rot={}
        order=list(s.models.keys())
        def go(mid):
            if mid in rot: return
            p=s.parent.get(mid)
            if p is not None and p in s.models: go(p); Rp,Pp=rot[p],pos[p]
            else: Rp,Pp=np.eye(3),np.zeros(3)
            props=s.models[mid]['props']; pre=props.get('PreRotation',[0,0,0])[:3]
            T=s.val(mid,'Lcl Translation',t); R=fbx.euler(pre)@fbx.euler(s.val(mid,'Lcl Rotation',t))
            pos[mid]=Pp+Rp@T; rot[mid]=Rp@R
        for mid in order: go(mid)
        return {s.models[m]['name']:pos[m] for m in pos}
def unit(v): return v/ (np.linalg.norm(v)+1e-9)
def swing(a,b):
    a=unit(a);b=unit(b); v=np.cross(a,b); c=a@b
    if c<-0.9999:
        ax=unit(np.cross(a,[1,0,0] if abs(a[0])<0.9 else [0,1,0])); return 2*np.outer(ax,ax)-np.eye(3)
    K=np.array([[0,-v[2],v[1]],[v[2],0,-v[0]],[-v[1],v[0],0]]); return np.eye(3)+K+K@K/(1+c)
def frame_basis(p,l):
    e1=unit(p); e3=unit(np.cross(e1,l)); e2=np.cross(e3,e1); return np.stack([e1,e2,e3],1)
Jm={k:np.array(v,float) for k,v in rig.J.items()}
LAT={'Hips':'hip','Spine':'mid','Spine1':'mid','Spine2':'sh','Neck':'sh','Head':'sh','LeftShoulder':'sh','RightShoulder':'sh'}
def lateral(kind,P,R=None):
    g=lambda n:P[mxname(n)]
    hip=g('LeftUpLeg')-g('RightUpLeg'); sh=g('LeftArm')-g('RightArm')
    return {'hip':hip,'sh':sh,'mid':unit(hip)+unit(sh)}[kind]
def restlat(kind):
    hip=Jm['LeftUpLeg']-Jm['RightUpLeg']; sh=Jm['LeftArm']-Jm['RightArm']; return {'hip':hip,'sh':sh,'mid':unit(hip)+unit(sh)}[kind]
S=0.42/104.27
def pose(clip,t,root0,inplace):
    P=clip.fk(t); Rb={}; pb={}
    for b in rig.BONES:
        a,c=rig.SEG[b]; pm=P[mxname(c)]-P[mxname(a)]; pr=Jm[c]-Jm[a]
        k=LAT.get(b)
        if k: Fa=frame_basis(pm,lateral(k,P)); Fr=frame_basis(pr,restlat(k)); R=Fa@Fr.T
        else: R=swing(pr,pm)
        Rb[b]=R
    h=P['mixamorig:Hips']; d=(h-root0)*S
    if inplace: d[0]=0; d[2]=0
    else: d[0]=d[0]; 
    pb['Hips']=Jm['Hips']+np.array([d[0],d[1],d[2]])
    for b in rig.BONES[1:]:
        p=rig.PARENT[b]; pb[b]=pb[p]+Rb[p]@(Jm[b]-Jm[p])
    M={}
    for b in rig.BONES: M[b]=(Rb[b],pb[b]-Rb[b]@Jm[b])
    return M
def clip_path(key): return glob.glob(A+'*'+key+'*.fbx')[0]
