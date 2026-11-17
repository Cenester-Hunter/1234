import struct,zlib,numpy as np,os
def parse(path):
    d=open(path,'rb').read(); ver=struct.unpack('<I',d[23:27])[0]; wide=ver>=7500
    def node(o):
        if wide: end,np_,pl,nl=struct.unpack('<QQQB',d[o:o+25]); h=25
        else: end,np_,pl,nl=struct.unpack('<IIIB',d[o:o+13]); h=13
        if end==0: return None,o+h
        name=d[o+h:o+h+nl].decode(); p=o+h+nl; props=[]
        for _ in range(np_):
            t=chr(d[p]); p+=1
            if t in 'CYIFDL':
                fm={'C':'<B','Y':'<h','I':'<i','F':'<f','D':'<d','L':'<q'}[t]; props.append(struct.unpack(fm,d[p:p+struct.calcsize(fm)])[0]); p+=struct.calcsize(fm)
            elif t in 'SR':
                n=struct.unpack('<I',d[p:p+4])[0]; p+=4; props.append(d[p:p+n]); p+=n
            else:
                n,enc,cl=struct.unpack('<III',d[p:p+12]); p+=12; raw=d[p:p+cl]; p+=cl
                if enc: raw=zlib.decompress(raw)
                dt={'f':'<f4','d':'<f8','i':'<i4','l':'<i8','b':'u1'}[t]; props.append(np.frombuffer(raw,dtype=dt))
        kids=[]
        while p<end:
            k,p=node(p)
            if k is None: break
            kids.append(k)
        return (name,props,kids),end
    o=27; top=[]
    while o<len(d):
        n,o=node(o)
        if n is None: break
        top.append(n)
    return top
def nm(b): return b.split(b'\x00')[0].decode()
def Rx(a): c,s=np.cos(a),np.sin(a); return np.array([[1,0,0],[0,c,-s],[0,s,c]])
def Ry(a): c,s=np.cos(a),np.sin(a); return np.array([[c,0,s],[0,1,0],[-s,0,c]])
def Rz(a): c,s=np.cos(a),np.sin(a); return np.array([[c,-s,0],[s,c,0],[0,0,1]])
def euler(v,order='XYZ'):
    a=np.radians(v); M={'X':Rx(a[0]),'Y':Ry(a[1]),'Z':Rz(a[2])}
    R=np.eye(3)
    for ax in order: R=M[ax]@R      # первым применяется первая ось порядка (eEulerXYZ)
    return R
def load(path):
    top=parse(path); obj=[t for t in top if t[0]=='Objects'][0]; con=[t for t in top if t[0]=='Connections'][0]
    models={}; curves={}; nodes={}
    for n,pr,kids in obj[2]:
        if n=='Model':
            id_=pr[0]; name=nm(pr[1]); props={}
            for k in kids:
                if k[0]=='Properties70':
                    for p in k[2]:
                        if p[0]=='P': props[nm(p[1][0])]=[x for x in p[1][4:]]
            models[id_]={'name':name,'props':props}
        elif n=='AnimationCurve':
            ch={k[0]:k[1][0] for k in kids if k[1]}
            curves[pr[0]]={'t':ch['KeyTime'],'v':ch['KeyValueFloat']}
        elif n=='AnimationCurveNode': nodes[pr[0]]={'name':nm(pr[1]),'curves':{}}
    parent={}; 
    for c in con[2]:
        if c[0]!='C': continue
        p=c[1]; typ=nm(p[0]); a,b=p[1],p[2]
        if typ=='OO' and a in models and b in models: parent[a]=b
        elif typ=='OP':
            prop=nm(p[3]) if len(p)>3 else ''
            if a in curves and b in nodes: nodes[b]['curves'][prop]=a
            elif a in nodes and b in models: nodes[a]['model']=b; nodes[a]['prop']=prop
    return models,parent,curves,nodes
