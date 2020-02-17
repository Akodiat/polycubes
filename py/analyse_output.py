import os
import numpy as np
import seaborn as sns
import matplotlib as mpl
import matplotlib.cm as cm
import matplotlib.pyplot as plt
from collections import Counter
import re
import subprocess
import multiprocessing
import polycubes

sns.set()


def rSizeFromRule(rule):
    return int(len(rule)/12)


def coordsFromFile(path):
    with open(path) as f:
        return [[int(c) for c in line.strip('()\n').split(',')] for line in f]


def readNMers_old(outDir):
    nMers = {}
    maxN = 100
    with open(outDir+'/1-mer') as f:
        nMers[1] = [line.strip('\n') for line in f]
    for n in range(2, maxN+1):
        try:
            with os.scandir(outDir+'/'+str(n)+'-mer') as it:
                nMers[n] = [f.name for f in it]
        except Exception:
            nMers[n] = []
        print([n, len(nMers[n])], end=' ')
    return nMers


def readResult(filename):
    result = {}
    nMers = {}
    nMerPat = '(\d+)-mer'
    with open(filename) as f:
        for line in f:
            rule, suffix = line.strip('\n').split('.')
            nMer = re.search(nMerPat, suffix)
            if nMer is not None:
                n = int(nMer.group(1))
                if n not in nMers:
                    nMers[n] = []
                    print(n, end=' ')
                nMers[n].append(rule)
            else:
                if suffix not in result:
                    result[suffix] = 0
                result[suffix] += 1
    result['nMers'] = nMers
    return result


def largestOfThree(x, y, z):
    r = []
    s = [x, y, z]
    s.sort(reverse=True)
    for i in x, y, z:
        if i == s[0]:
            r.append(2)
            continue
        if i == s[1]:
            r.append(1)
            continue
        if i == s[2]:
            r.append(0)
            continue
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
            a = [rx, ry, rz].index(2)
            b = [rx, ry, rz].index(1)
            c = [rx, ry, rz].index(0)
            break

    return a, b, c


def normCoords2(coords):
    cs = sorted(coords, key=lambda x: np.linalg.norm(x), reverse=True)

    for x, y, z in cs:
        rx, ry, rz = largestOfThree(x, y, z)
        # if rx != ry and rx != rz and ry != rz:


def normCoords3(coords):
    # Find the plane closest from the polycube surface, that has the most cubes
    # in it. Make that the direction of the new unit x vector.

    countX, countY, countZ = [Counter(x) for x in np.transpose(coords)]

    # Find surface planes in negative direction:
    xN, yN, zN = [min(key) for key in (countX, countY, countZ)]

    # Find surface planes in positive direction:
    xP, yP, zP = [max(key) for key in (countX, countY, countZ)]

    newX, newY, newZ = ([1, 0, 0], [0, 1, 0], [0, 0, 1])

    # First loop through looking for new X,
    # then start over and look for new Y
    # = better?

    while xP > xN and yP > yN and zP > zN:
        vals = {'xP':countX[xP], 'yP':countY[yP], 'zP':countZ[zP],
                'xN':countX[xN], 'yN':countY[yN], 'zN':countZ[zN]}
        sortedVals = sorted([val for val in vals],
                            key=lambda v: vals[v],
                            reverse=True)
        # If we have a unique winner:
        if vals[sortedVals[0]] != vals[sortedVals[1]]:
            winner = vals[sortedVals[0]]
            print("{} has the largest cube count".format(winner))
            if   winner == 'xP': newX = [1,0,0]
            elif winner == 'yP': newX = [0,1,0]
            elif winner == 'zP': newX = [0,0,1]
            elif winner == 'xN': newX = [-1,0,0]
            elif winner == 'yN': newX = [0,-1,0]
            elif winner == 'zN': newX = [0,0,-1]
            break
        if vals[sortedVals[1]] != vals[sortedVals[2]]:
            # Also need to check for P vs N on same axis
            # for example sortedVals[1][0] != sortedVals[2][0]
            runnerup = vals[sortedVals[1]]
            print("{} has the largest cube count".format(winner))
            if   winner == 'xP': newX = [1,0,0]
            elif winner == 'yP': newX = [0,1,0]
            elif winner == 'zP': newX = [0,0,1]
            elif winner == 'xN': newX = [-1,0,0]
            elif winner == 'yN': newX = [0,-1,0]
            elif winner == 'zN': newX = [0,0,-1]
            break
        xP+=1; yP+=1; zP+=1
        xN-=1; yN-=1; zN-=1

    m = getRotMat(newX, newY, newZ)
    coords = [m*np.matrix(c).transpose() for c in coords]


# oldX, oldY, oldZ is [1,0,0], [0,1,0] and [0,0,1]
def getRotMat(newX, newY, newZ):
    return np.matrix([newX, newY, newZ]).transpose()

def calcPoints(nMers):
    points = []
    for key in nMers:
        nMer = nMers[key]
        for rule in nMer:
            if rule is not None:
                points.append([key, calcComplexity(rule)])
    return points

def calcNRulesTested_old(outdir):
    n = 0
    categories = {}
    with os.scandir(outdir) as it:
        for entry in it:
            if entry.is_file():
                if '.' in entry.name:
                    n += 1
                    print('.', end='')
                    pass
                else:
                    with open(entry.path) as f:
                        for line in f:
                            if entry.name not in categories:
                                categories[entry.name] = 1
                            else:
                                categories[entry.name] += 1
                            n += 1
                    #print("Counted all rules in file "+entry.name)
            else:
                with os.scandir(entry.path) as subit:
                    for subentry in subit:
                        if subentry.is_file() and '.' in subentry.name:
                            if entry.name not in categories:
                                categories[entry.name] = 1
                            else:
                                categories[entry.name] += 1
                            n += 1
                #print("Counted all rules in dir "+entry.name)
    return [n, categories]

def calcNRulesTested(result):
    nRules = 0
    categories = {}
    for cat, val in result.items():
        if cat is 'nMers':
            for n, rules in val.items():
                if n not in categories:
                    categories[n] = 0
                categories[n] += len(rules)
                nRules += categories[n]
        else:
            categories[cat] = val
            nRules += val
    return [nRules, categories]

def toUrl(filename):
    rule = filename.split('.')[0]
    url = 'https://akodiat.github.io/polycubes/view?hexRule='
    return url+rule


def parseHexRule(hexRule):
    ruleset = []
    faces = []
    for i in range(0, len(hexRule), 2):
        if i%12 == 0 and i != 0:
            ruleset.append(faces)
            faces = []
        face_hex = hexRule[i:i+2]
        face_int = int(face_hex, 16)
        face_bin = bin(face_int)[2:].zfill(8)
        face = {}
        sign = int(face_bin[0], 2)
        face['color'] = int(face_bin[1:6], 2) * (-1 if sign else 1)
        face['orientation'] = int(face_bin[6:8], 2)
        faces.append(face)
    ruleset.append(faces)
    return ruleset


def getNColors(ruleset):
    colorset = set([abs(face['color']) for rule in ruleset for face in rule])
    if 0 in colorset:
        return len(colorset) - 1
    else:
        return len(colorset)


def getNColorsFromFilename(filename):
    return getNColors(simplifyRuleset(parseHexRule(filename)))


def getMinimumColorsPerNMer():
    return [
    [
            getNColorsFromFilename(f), simplifyHexRule(f), n
    ] for f, n in [
            min(nMers[n],
                key = lambda x: getNColorsFromFilename(x)
            ) for n in nMers if len(nMers[n]) > 0
    ]]

def printMinimumColorsPerNMer():
    for n in nMers:
        if len(nMers[n]) > 0:
            f = min(nMers[n], key = lambda x: getNColorsFromFilename(x))
            print(getNColorsFromFilename(f), simplifyHexRule(f), n)


def printMinimumComplPerNMer():
    for n in nMers:
        if len(nMers[n]) > 0:
            f = min(nMers[n], key = lambda x: calcComplexity(x))
            print(calcComplexity(f), simplifyHexRule(f), n)


def getRulesInRuleset(hexRule):
    n = 12
    return set(hexRule[i:i+n] for i in range(0, len(hexRule), n))


def calcRuleIntersection(hexRuleA, hexRuleB):
    return len(getRulesInRuleset(hexRuleA) & getRulesInRuleset(hexRuleB))


def findOverlappingRule(rule, nMer):
    for other in nMers[nMer]:
        other = simplifyHexRule(other)
        if calcRuleIntersection(rule, other) == rSizeFromRule(rule):
            print(other)


def calculateSearchSpaceSize(
        nRules, nColors,
        nRotations=4,  # Each polycube face has one of 4 possible rotations
        nInteractionSites=6):  # Each polycube has 6 faces
    return pow(nRotations*(1 + 2*nColors), nInteractionSites*nRules)


def ruleToHex(ruleset):
    hexRule = ''
    for rule in ruleset:
        for face in rule:
            sign = bin(face['color'] < 0)[2:]
            color = bin(abs(face['color']))[2:].zfill(5)
            orientation = bin(abs(face['orientation']))[2:].zfill(2)
            binStr = sign + color + orientation
            hexStr = hex(int(binStr, 2))[2:].zfill(2)
            hexRule += hexStr
    return hexRule


def simplifyRuleset(ruleset):
    colors = [face['color'] for rule in ruleset for face in rule]
    tally = Counter(colors)
    newRuleset = []
    for rule in ruleset:
        allZero = True
        for face in rule:
            c = face['color']
            if tally[c*-1] == 0:
                face['color'] = 0
            if face['color'] == 0:
                face['orientation'] = 0
            else:
                allZero = False
        if not allZero:
            newRuleset.append(rule)
    colorset = [x for x in {
            abs(face['color']) for rule in newRuleset for face in rule
    }.difference({0})]
    for rule in newRuleset:
        for face in rule:
            c = face['color']
            if c != 0:
                face['color'] = colorset.index(abs(c)) + 1
                if c < 0:
                    face['color'] *= -1
    return newRuleset


def calcComplexity(hexRule):
    ruleset = parseHexRule(hexRule)
    simplifyRuleset(ruleset)
    nColors = max(face['color'] for rule in ruleset for face in rule)
    nRules = len(ruleset)
    return nColors*nRules


def simplifyHexRule(hexRule):
    ruleset = parseHexRule(hexRule)
    simplifyRuleset(ruleset)
    return ruleToHex(ruleset)


def groupByPhenotype(rules):
    groups = []
    for rule in rules:
        foundGroup = False
        for group in groups:
            if polycubes.checkEquality(rule, group[0]):
                group.append(rule)
                foundGroup = True
                break
        if not foundGroup:
            groups.append([rule])
    return groups


def plotRuleSizeVsPolycubeSize(nMers):
    points = calcPoints(nMers)
    x, y = np.transpose(points)
    xMax, yMax = max(x), max(y)
    plt.figure(figsize=mpl.figure.figaspect(yMax/xMax))

    plt.hist2d(x, y,
        norm=mpl.colors.LogNorm(),
        bins=(np.arange(1,xMax+2) - 0.5, np.arange(1,yMax+2) - 0.5),
        cmap='summer'
    )
    plt.grid(b=None)
    plt.xticks([1] + list(range(5,xMax-5,5)) + [xMax])
    plt.yticks(range(1,yMax+1))
    plt.colorbar(label='Count')
    plt.xlabel('Polycube size')
    plt.ylabel('Complexity (nColors+nRules)')
    plt.title(suffix.strip('_'))
    plt.draw()
    plt.savefig("../doc/rs_vs_ps"+suffix+".eps", bbox_inches='tight')
    plt.savefig("../doc/rs_vs_ps"+suffix+".svg", bbox_inches='tight')
    plt.savefig("../doc/rs_vs_ps"+suffix+".png", dpi=600, bbox_inches='tight')
    plt.show()


def getPhenosForNMer(n):
    phenosn = []
    if(n==2):
        groups = [nMers[n]] # Only one phenotype possible
    else:
        groups = groupByPhenotype(nMers[n])
    for group in groups:
        compl = min(calcComplexity(rule) for rule in group)
        count = len(group)
        phenosn.append({
            'count': count,
            'compl': compl,
            'rule': simplifyHexRule(group[0])
        })
    return (n, phenosn)


phenos = {}
def calcPhenos():
    global phenos
    phenos = {}
    with multiprocessing.Pool(8) as p:
        for n, phenosn in p.imap_unordered(
                getPhenosForNMer,
                reversed(sorted([k for k in nMers.keys() if k != 1]))):
            print("{} phenotypes of {}-mers".format(len(phenosn), n))
            phenos[n] = phenosn


def plotProbVsPhenotypeCompl(nMers, nRules):
    x = []
    y = []
    for n in phenos:
        nphenos = phenos[n]
        for pheno in nphenos:
            x.append(pheno['compl'])
            y.append(pheno['count']/nRules)

    # Plot
    plt.figure()
    ax = plt.gca()
    ax.scatter(x, y, alpha=0.2, edgecolors='none')
    ax.set_yscale('log')
    plt.ylabel('P(x)')
    plt.xlabel('Min complexity (# of colors * rulesize)')
    ax.set_ylim(1/(2*nRules), 1/10)
    plt.draw()
    plt.savefig("../doc/prob_vs_compl"+suffix+".eps", bbox_inches='tight')
    plt.savefig("../doc/prob_vs_compl"+suffix+".svg", bbox_inches='tight')
    plt.savefig("../doc/prob_vs_compl"+suffix+".png", dpi=600, bbox_inches='tight')
    plt.show()


def plotProbVsSize(nMers, nRules):
    #[[n, ft.reduce((lambda x, y: x + rSizeFromFile(y)/nRules), nMers[n], 0)] for n in nMers]
    points = {}
    plt.figure()
    for n in nMers:
        if len(nMers[n]) > 0 and n > 1:
            points[n] = [calcComplexity(rule) for rule in nMers[n]]
            counts, bin_edges = np.histogram(points[n], 1000)
            bin_centres = (bin_edges[:-1] + bin_edges[1:])/2
            ps = [[bin_centres[i], count] for i, count in enumerate(counts) if count > 0]
            plt.semilogy([p[0] for p in ps], [p[1] for p in ps], 'o',
                         color=cm.summer(np.sqrt(n/64)))
    plt.xlabel('Complexity (nColors+nRules)')
    plt.ylabel('Count')
    plt.title(suffix.strip('_'))
    plt.legend(ncol=3, bbox_to_anchor=(1, 1))
    plt.draw()
    plt.savefig("../doc/prob_vs_size"+suffix+".eps", bbox_inches='tight')
    plt.savefig("../doc/prob_vs_size"+suffix+".svg", bbox_inches='tight')
    plt.savefig("../doc/prob_vs_size"+suffix+".png", dpi=600, bbox_inches='tight')
    plt.show()



def plotCategoryPie(categories):
    categories['others'] = 0
    for key, val in categories.items():
        if val < 1000:
            print(key)
            categories['others'] += val
            categories[key] = 0
    keys = []; vals = []
    for key, val in categories.items():
        if val > 0:
            if key == 'oub100':
                key = 'unbounded'
            keys.append(key)
            vals.append(val)
    plt.figure()
    y_pos = np.arange(len(vals))
    print(y_pos)
    plt.pie(vals, labels=keys, autopct='%1.1f%%')
    plt.axis('equal')

result = readResult('/local/home/johansson/poly_out/out_1e7')
nMers = result['nMers']


nRules, categories = calcNRulesTested(result)
suffix = '{:.1E} rules'.format(nRules)

calcPhenos()
plotProbVsPhenotypeCompl(nMers, nRules)

# x, y, phenos = plotProbVsPhenotypeCompl(nMers, nRules)

# topcompl = max((max(phenos[i], key=lambda p: p['compl']) for i in phenos), key=lambda p: p['compl'])

# middle = min((min(phenos[i], key=lambda p: abs(p['compl']-9)+abs(p['count']/nRules - pow(10,-5))) for i in phenos), key=lambda p: abs(p['compl']-9)+abs(p['count']/nRules - pow(10,-5)))

#plotRuleSizeVsPolycubeSize(nMers)

#plotProbVsSize(nMers, nRules)

#percentages = {key: 100*val/nRules for key, val in categories.items() if val > 0}
#plt.figure()
#plt.bar(range(len(percentages)), list(percentages.values()), align='center')
#plt.xticks(range(len(percentages)), list(percentages.keys()))

print("Evaluated {} rules in total".format(nRules))
#plotCategoryPie(categories)


#sns.jointplot(x,y, kind='kde').set_axis_labels('Polycube size', 'Rule size')

