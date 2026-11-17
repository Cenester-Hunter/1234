import numpy as np
# Кости (Mixamo) и их положение в позе сетки (лицом к +Z, рост 1.0, пол y=-0.5). x>0 — левая сторона персонажа (как у Mixamo).
J={
 'Hips':(0,-0.08,0.02),'Spine':(0,0.0,0.02),'Spine1':(0,0.12,0.02),'Spine2':(0,0.24,0.02),'Neck':(0,0.36,0.03),'Head':(0,0.41,0.04),'HeadTop':(0,0.50,0.05),
 'LeftShoulder':(0.05,0.34,0.03),'LeftArm':(0.16,0.33,0.02),'LeftForeArm':(0.165,0.18,0.03),'LeftHand':(0.165,0.03,0.04),'LeftHandEnd':(0.165,-0.04,0.05),
 'RightShoulder':(-0.05,0.34,0.03),'RightArm':(-0.16,0.33,0.02),'RightForeArm':(-0.165,0.18,0.03),'RightHand':(-0.165,0.03,0.04),'RightHandEnd':(-0.165,-0.04,0.05),
 'LeftUpLeg':(0.09,-0.10,0.02),'LeftLeg':(0.13,-0.30,0.0),'LeftFoot':(0.15,-0.46,-0.02),'LeftToeBase':(0.16,-0.49,0.06),'LeftToeEnd':(0.16,-0.50,0.12),
 'RightUpLeg':(-0.09,-0.10,0.02),'RightLeg':(-0.13,-0.30,0.0),'RightFoot':(-0.15,-0.46,-0.02),'RightToeBase':(-0.16,-0.49,0.06),'RightToeEnd':(-0.16,-0.50,0.12),
}
BONES=['Hips','Spine','Spine1','Spine2','Neck','Head','LeftShoulder','LeftArm','LeftForeArm','LeftHand','RightShoulder','RightArm','RightForeArm','RightHand','LeftUpLeg','LeftLeg','LeftFoot','LeftToeBase','RightUpLeg','RightLeg','RightFoot','RightToeBase']
PARENT={'Hips':None,'Spine':'Hips','Spine1':'Spine','Spine2':'Spine1','Neck':'Spine2','Head':'Neck','LeftShoulder':'Spine2','LeftArm':'LeftShoulder','LeftForeArm':'LeftArm','LeftHand':'LeftForeArm',
 'RightShoulder':'Spine2','RightArm':'RightShoulder','RightForeArm':'RightArm','RightHand':'RightForeArm','LeftUpLeg':'Hips','LeftLeg':'LeftUpLeg','LeftFoot':'LeftLeg','LeftToeBase':'LeftFoot',
 'RightUpLeg':'Hips','RightLeg':'RightUpLeg','RightFoot':'RightLeg','RightToeBase':'RightFoot'}
# сегмент кости для расчёта весов: (начало, конец)
SEG={'Hips':('Hips','Spine'),'Spine':('Spine','Spine1'),'Spine1':('Spine1','Spine2'),'Spine2':('Spine2','Neck'),'Neck':('Neck','Head'),'Head':('Head','HeadTop'),
 'LeftShoulder':('LeftShoulder','LeftArm'),'LeftArm':('LeftArm','LeftForeArm'),'LeftForeArm':('LeftForeArm','LeftHand'),'LeftHand':('LeftHand','LeftHandEnd'),
 'RightShoulder':('RightShoulder','RightArm'),'RightArm':('RightArm','RightForeArm'),'RightForeArm':('RightForeArm','RightHand'),'RightHand':('RightHand','RightHandEnd'),
 'LeftUpLeg':('LeftUpLeg','LeftLeg'),'LeftLeg':('LeftLeg','LeftFoot'),'LeftFoot':('LeftFoot','LeftToeBase'),'LeftToeBase':('LeftToeBase','LeftToeEnd'),
 'RightUpLeg':('RightUpLeg','RightLeg'),'RightLeg':('RightLeg','RightFoot'),'RightFoot':('RightFoot','RightToeBase'),'RightToeBase':('RightToeBase','RightToeEnd')}
def weights(Q,p=3.0,keep=3):
    n=len(Q); D=np.zeros((n,len(BONES)))
    for i,b in enumerate(BONES):
        a=np.array(J[SEG[b][0]]); c=np.array(J[SEG[b][1]]); ab=c-a; t=np.clip(((Q-a)@ab)/(ab@ab),0,1); pr=a+t[:,None]*ab
        D[:,i]=np.linalg.norm(Q-pr,axis=1)
        # ограничение по сторонам: левые кости — только x>0, правые — только x<0 (с запасом), иначе штраф
        if b.startswith('Left'): D[:,i]+=np.where(Q[:,0]<0.0,(-Q[:,0])*6,0)
        if b.startswith('Right'): D[:,i]+=np.where(Q[:,0]>0.0,(Q[:,0])*6,0)
    W=1.0/(D+0.012)**p
    idx=np.argsort(-W,axis=1)[:,:keep]; Wk=np.take_along_axis(W,idx,1); Wk/=Wk.sum(1,keepdims=True)
    return idx.astype(np.int32),Wk.astype(np.float32)
