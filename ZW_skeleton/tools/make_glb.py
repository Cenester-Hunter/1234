import json,struct,numpy as np,glob,os
sk=json.load(open('skeleton.json')); names=[b['name'] for b in sk['bones']]; idx={n:i for i,n in enumerate(names)}
buf=bytearray(); views=[]; accs=[]
def add(arr,typ,ct,count,mn=None,mx=None):
    while len(buf)%4: buf.append(0)
    off=len(buf); buf.extend(arr.tobytes()); views.append({'buffer':0,'byteOffset':off,'byteLength':len(arr.tobytes())})
    a={'bufferView':len(views)-1,'componentType':ct,'count':count,'type':typ}
    if mn is not None: a['min']=mn; a['max']=mx
    accs.append(a); return len(accs)-1
nodes=[]
for b in sk['bones']:
    n={'name':b['name'],'translation':[v*0.01 for v in b['t']],'rotation':b['q']}; nodes.append(n)
for b in sk['bones']:
    if b['parent']: nodes[idx[b['parent']]].setdefault('children',[]).append(idx[b['name']])
anims=[]
for f in sorted(glob.glob('clips/*.json')):
    c=json.load(open(f)); nm=os.path.basename(f)[:-5]; n=c['frames']
    t=(np.arange(n)/c['fps']).astype('<f4'); ta=add(t,'SCALAR',5126,n,[float(t[0])],[float(t[-1])])
    ch=[];sm=[]
    for b in names:
        q=np.array(c['q'][b],'<f4'); a=add(q,'VEC4',5126,n); sm.append({'input':ta,'output':a,'interpolation':'LINEAR'}); ch.append({'sampler':len(sm)-1,'target':{'node':idx[b],'path':'rotation'}})
    r=(np.array(c['root'],'<f4')*0.01); a=add(r,'VEC3',5126,n); sm.append({'input':ta,'output':a,'interpolation':'LINEAR'}); ch.append({'sampler':len(sm)-1,'target':{'node':idx['Hips'],'path':'translation'}})
    anims.append({'name':nm,'channels':ch,'samplers':sm})
j={'asset':{'version':'2.0','generator':'ZOMBIE WARRIOR skeleton pack'},'scene':0,'scenes':[{'nodes':[idx['Hips']]}],'nodes':nodes,'animations':anims,'accessors':accs,'bufferViews':views,'buffers':[{'byteLength':len(buf)}]}
js=json.dumps(j,separators=(',',':')).encode(); js+=b' '*((4-len(js)%4)%4)
while len(buf)%4: buf.append(0)
out=struct.pack('<III',0x46546C67,2,12+8+len(js)+8+len(buf))+struct.pack('<II',len(js),0x4E4F534A)+js+struct.pack('<II',len(buf),0x004E4942)+bytes(buf)
open('ZW_skeleton.glb','wb').write(out); print(len(out))
