import os
import numpy as np
import seaborn as sns; sns.set()
import matplotlib as mpl
import matplotlib.pyplot as plt

outDir = '../cpp/out'

def rSizeFromFile(filename):
    return int(len(filename.split('.')[0])/12)

def pSizeFromFile(filename):
    return len(coordsFromFile(filename))

def coordsFromFile(filename):
    nMer = filename.split('.')[-1]
    with open(outDir+'/'+nMer+'/'+filename) as f:
        return [[int(c) for c in line.strip('()\n').split(',')] for line in f]

#nmers = [f for f in os.scandir(outDir) if f.is_dir()]
"""
with os.scandir(outDir) as it:
    for f in it:
        if(f.is_dir()):
            print(f.name)
"""

def readNMers(outDir):
    nMers = {}
    maxN = 100
    for n in range(2, maxN+1):
        try:
            with os.scandir(outDir+'/'+str(n)+'-mer') as it:
                nMers[n] = [f.name for f in it]
        except Exception:
            nMers[n] = []
        print([n, len(nMers[n])])
    return nMers

def largestOfThree(x, y, z):
    r = []
    s = [x,y,z]; s.sort()
    for i in x,y,z:
        if i == s[-1]:
            r.append(2); continue
        if i == s[-2]:
            r.append(1); continue
        if i == s[-3]:
            r.append(0); continue
    return r

def normCoords(coords):
    xs, ys, zs = np.transpose(coords)
    xs -= xs.min(); xs.sort()
    ys -= ys.min(); ys.sort()
    zs -= zs.min(); zs.sort()

    score = np.array([0, 0, 0])
    a, b, c = -1, -1, -1

    for i in range(len(coords)):
        j = -(i+1)
        ranking = largestOfThree(xs[j], ys[j], zs[j])
        score += ranking
        print(score)
        rx, ry, rz = largestOfThree(*score)
        # If we have a definite ranking:
        if rx != ry and rx != rz and ry != rz:
            a = [rx,ry,rz].index(2)
            b = [rx,ry,rz].index(1)
            c = [rx,ry,rz].index(0)
            break

    return a, b, c

nMers = readNMers(outDir)

points = []
for key in nMers:
    nMer = nMers[key]
    for f in nMer:
        if f is not None:
            points.append([pSizeFromFile(f), rSizeFromFile(f)])

x, y = np.transpose(points)
sns.jointplot(x,y, kind='kde').set_axis_labels('Polycube size', 'Rule size')

plt.figure()

plt.hist2d(x, y, norm=mpl.colors.LogNorm(), bins=(30, 4), cmap='Blues')
plt.colorbar(label='frequency')
plt.show()
