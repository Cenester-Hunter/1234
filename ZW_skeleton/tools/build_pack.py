import sys, json, struct, os, glob, numpy as np
sys.path.insert(0,'/tmp/claude-0/-home-claude/f0f9a605-504f-5659-ac94-1b59dc45011e/scratchpad/pack3/ZW_skeleton/tools')
import fbx, anim, rig
A='/tmp/claude-0/-home-claude/f0f9a605-504f-5659-ac94-1b59dc45011e/scratchpad/fbx/'
FPS=30
BONES=rig.BONES+['HeadTop','LeftHandEnd','RightHandEnd','LeftToeEnd','RightToeEnd']
PAR=dict(rig.PARENT); PAR.update({'HeadTop':'Head','LeftHandEnd':'LeftHand','RightHandEnd':'RightHand','LeftToeEnd':'LeftToeBase','RightToeEnd':'RightToeBase'})
# клипы: имя в нашем наборе -> (подстрока имени файла, зацикленный?, тип)
CLIPS=[
 ('run','Sword_And_Shield_Run',True,'move'),
 ('jog','Jog_In_Circle',True,'move'),
 ('jump','Sword_And_Shield_Jump',False,'move'),
 ('attack_punch','Punching',False,'attack'),
 ('attack_elbow','Illegal_Elbow_Punch',False,'attack'),
 ('attack_kick','Mma_Kick',False,'attack'),
 ('attack_sword','42e6f78d-Sword_And_Shield_Attack',False,'attack'),
 ('attack_spin','Chapa-Giratoria',False,'attack'),
 ('attack_sword2','530fd508-Sword_And_Shield_Attack',False,'attack'),
 ('attack_slash','6c9131a0-Sword_And_Shield_Slash',False,'attack'),
 ('attack_greatsword','Great_Sword_Slash',False,'attack'),
 ('cast_magic','Standing_2H_Magic_Attack_01',False,'attack'),
 ('smoking','Smoking',False,'cast'),
 ('attack_turnkick','Rifle_Turn_And_Kick',False,'attack'),
 ('hit_uppercut','Receive_Uppercut',False,'hit'),
 ('die','Dying',False,'death'),
]
def path(key): return glob.glob(A+'*'+key+'*.fbx')[0]
def mat2quat(R):
    t=np.trace(R)
    if t>0: s=np.sqrt(t+1)*2; q=[(R[2,1]-R[1,2])/s,(R[0,2]-R[2,0])/s,(R[1,0]-R[0,1])/s,0.25*s]
    elif R[0,0]>R[1,1] and R[0,0]>R[2,2]: s=np.sqrt(1+R[0,0]-R[1,1]-R[2,2])*2; q=[0.25*s,(R[0,1]+R[1,0])/s,(R[0,2]+R[2,0])/s,(R[2,1]-R[1,2])/s]
    elif R[1,1]>R[2,2]: s=np.sqrt(1+R[1,1]-R[0,0]-R[2,2])*2; q=[(R[0,1]+R[1,0])/s,0.25*s,(R[1,2]+R[2,1])/s,(R[0,2]-R[2,0])/s]
    else: s=np.sqrt(1+R[2,2]-R[0,0]-R[1,1])*2; q=[(R[0,2]+R[2,0])/s,(R[1,2]+R[2,1])/s,0.25*s,(R[1,0]-R[0,1])/s]
    q=np.array(q); return q/np.linalg.norm(q)   # x,y,z,w
def quat2mat(q):
    x,y,z,w=q; return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
def fbxname(b):
    return anim.mxname(b)
# ---- канонический скелет: из бинд-позы первого файла
base=anim.Clip(path('Sword_And_Shield_Run'))
def local_rest(clip,b,t=0):
    mid=clip.byname[fbxname(b)]; props=clip.models[mid]['props']
    T=np.array(props.get('Lcl Translation',[0,0,0])[:3],float); pre=props.get('PreRotation',[0,0,0])[:3]; R=fbx.euler(pre)@fbx.euler(props.get('Lcl Rotation',[0,0,0])[:3])
    return T,R
SK=[]
for b in BONES:
    T,R=local_rest(base,b); SK.append({'name':b,'parent':PAR.get(b),'t':[round(float(x),4) for x in T],'q':[round(float(x),6) for x in mat2quat(R)]})
skeleton={'units':'cm','up':'+Y','forward':'+Z','left_side':'+X','height_cm':170,'bones':SK,
 'sockets':{'weapon':{'bone':'RightHand','tip_bone':'RightHandEnd','note':'оружие крепится к правой кисти и направлено вдоль RightHand→RightHandEnd'}}}
# ---- кадры клипов
def sample(clip):
    n=int(round(clip.dur*FPS))+1; out=[]; hips0=clip.fk(0)['mixamorig:Hips'].copy()
    rest={b:local_rest(clip,b) for b in BONES}
    for i in range(n):
        t=min(i/FPS,clip.dur); fr={}
        for b in BONES:
            mid=clip.byname[fbxname(b)]; props=clip.models[mid]['props']; pre=props.get('PreRotation',[0,0,0])[:3]
            R=fbx.euler(pre)@fbx.euler(clip.val(mid,'Lcl Rotation',t)); fr[b]=mat2quat(R)
        # знак кватерниона — непрерывность
        out.append(fr)
    for b in BONES:
        for i in range(1,n):
            if np.dot(out[i][b],out[i-1][b])<0: out[i][b]=-out[i][b]
    hid=clip.byname['mixamorig:Hips']; hip=[clip.val(hid,'Lcl Translation',min(i/FPS,clip.dur)) for i in range(n)]
    return out,np.array(hip)
def world(clipdata,i,hip):
    pos={};rot={}
    for b in BONES:
        sk=next(s for s in SK if s['name']==b); p=PAR.get(b); T=np.array(sk['t']) if b!='Hips' else hip
        R=quat2mat(clipdata[i][b])
        if p: pos[b]=pos[p]+rot[p]@T; rot[b]=rot[p]@R
        else: pos[b]=T.copy(); rot[b]=R
    return pos,rot
clips={}; actions={}
for name,key,loop,typ in CLIPS:
    c=anim.Clip(path(key)); fr,hip=sample(c); n=len(fr)
    inplace=name in('run','jog')
    root=hip.copy()
    if inplace: root[:,0]=hip[0,0]; root[:,2]=hip[0,2]
    clips[name]={'fps':FPS,'frames':n,'duration':round(c.dur,3),'loop':loop,'type':typ,'in_place':inplace,
      'root':[[round(float(v),3) for v in r] for r in root],
      'q':{b:[[round(float(v),5) for v in fr[i][b]] for i in range(n)] for b in BONES}}
    # тайминги ударов
    if typ=='attack':
        ext={}; 
        for L in ['LeftHandEnd','RightHandEnd','LeftToeEnd','RightToeEnd','LeftFoot','RightFoot']: ext[L]=[]
        W=[world(fr,i,root[i]) for i in range(n)]
        for i in range(n):
            pos=W[i][0]; h=pos['Hips']
            for L in ext: ext[L].append(float(np.linalg.norm((pos[L]-h)[[0,2]])))
        rng={L:max(v)-min(v) for L,v in ext.items()}; allowed={'attack_punch':['LeftHandEnd','RightHandEnd'],'attack_elbow':['LeftHandEnd','RightHandEnd'],'attack_sword':['RightHandEnd'],'attack_sword2':['RightHandEnd'],'attack_slash':['RightHandEnd'],'attack_greatsword':['RightHandEnd','LeftHandEnd'],'cast_magic':['RightHandEnd','LeftHandEnd'],'attack_kick':['LeftToeEnd','RightToeEnd'],'attack_spin':['LeftToeEnd','RightToeEnd'],'attack_turnkick':['LeftToeEnd','RightToeEnd']}[name]; limb=max(allowed,key=lambda L:rng[L])
        e=np.array(ext[limb]); lo,hi=e.min(),e.max(); pk=int(e.argmax())
        a0=pk
        while a0>0 and e[a0-1]>=lo+0.75*(hi-lo): a0-=1
        a1=pk
        while a1<n-1 and e[a1+1]>=lo+0.75*(hi-lo): a1+=1
        s0=a0
        while s0>0 and e[s0-1]>=lo+0.15*(hi-lo): s0-=1
        r1=a1
        while r1<n-1 and e[r1+1]>=lo+0.25*(hi-lo): r1+=1
        actions[name]={'clip':name,'strike_bone':limb,'type':'kick' if 'Toe' in limb else 'punch/strike','startup_frames':[s0,a0],'active_frames':[a0,a1],'recovery_frames':[a1,n-1],
          'peak_frame':pk,'reach_cm':round(float(hi),1),'reach_over_height':round(float(hi)/170,3),'comment':'тайминги вычислены автоматически по движению конечности; правятся в actions.json'}
# idle: синтез из стойки первого кадра sword-атаки + дыхание
c=anim.Clip(path('42e6f78d-Sword_And_Shield_Attack')); fr0,hip0=sample(c); N=60
idle_q={b:[] for b in BONES}
for i in range(N):
    ph=2*np.pi*i/N
    for b in BONES:
        q=fr0[0][b].copy()
        amp={'Spine':1.2,'Spine1':1.6,'Spine2':1.8,'Neck':-1.0,'Head':-0.8,'LeftArm':0.8,'RightArm':-0.8}.get(b,0)
        if amp:
            a=np.radians(amp*np.sin(ph))/2; dq=np.array([np.sin(a),0,0,np.cos(a)])      # лёгкий наклон вокруг X (дыхание)
            x1,y1,z1,w1=q; x2,y2,z2,w2=dq
            q=np.array([w1*x2+x1*w2+y1*z2-z1*y2,w1*y2-x1*z2+y1*w2+z1*x2,w1*z2+x1*y2-y1*x2+z1*w2,w1*w2-x1*x2-y1*y2-z1*z2])
        idle_q[b].append([round(float(v),5) for v in q])
rootI=[[float(hip0[0][0]),float(hip0[0][1]+0.4*np.sin(2*np.pi*i/N)),float(hip0[0][2])] for i in range(N)]
clips['idle']={'fps':FPS,'frames':N,'duration':N/FPS,'loop':True,'type':'move','in_place':True,'synthesized':True,'root':rootI,'q':idle_q}
actions_map={
 'buttons':{'idle':'idle','move_forward':'run','move_back':'jog','jump':'jump','punch':'attack_punch','elbow':'attack_elbow','kick':'attack_kick','sword':'attack_sword','sword2':'attack_sword2','slash':'attack_slash','great_sword':'attack_greatsword','magic':'cast_magic','smoking':'smoking','spin_kick':'attack_spin','turn_kick':'attack_turnkick','hit':'hit_uppercut','die':'die'},
 'strikes':actions,
 'missing':['block (защита)','getup (вставание)','win (победная поза)','hit_back (удар в спину)'],
 'note':'idle синтезирован (дыхание поверх стойки), остальные — из Mixamo; блока в наборе нет'}
json.dump(skeleton,open('skeleton.json','w'),ensure_ascii=False,separators=(',',':'))
os.makedirs('clips',exist_ok=True)
for k,v in clips.items(): json.dump(v,open(f'clips/{k}.json','w'),separators=(',',':'))
json.dump(actions_map,open('actions.json','w'),ensure_ascii=False,indent=1)
print({k:(v['frames'],v['duration']) for k,v in clips.items()})
for k,v in actions.items(): print(k,v['strike_bone'],v['startup_frames'],v['active_frames'],v['recovery_frames'],v['reach_cm'])
