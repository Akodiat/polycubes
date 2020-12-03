from collections import Counter
import os
import pickle
import numpy as np

def loadPhenos(path="../cpp/out/3d/phenos"):
    phenos = []
    for root, _, files in os.walk(path):
        for file in files:
            if "phenos.p" in file:
                phenos.extend(pickle.load(open(os.path.join(root, file), "rb")))
    return phenos

def getMinColorsAndCubeTypes(hexRule):
    ruleset = simplifyRuleset(parseHexRule(hexRule))
    nColors = max(face['color'] for rule in ruleset for face in rule)
    nCubeTypes = len(ruleset)
    return (nColors, nCubeTypes)

def getMinComplexity(genotypes):
    minNc = minNt = minLz = float('Inf')
    for hexRule in genotypes:
        rSimpl = simplifyRuleset(parseHexRule(hexRule))
        simplHex = ruleToHex(rSimpl)
        lz = lzFromHexRule(simplHex)
        nc = max(face['color'] for rule in rSimpl for face in rule)
        nt = len(rSimpl)
        if nc < minNc:
            minNc_r = simplHex
            minNc = nc
        if nt < minNt:
            minNt_r = simplHex
            minNt = nt
        if lz < minLz:
            minLz_r = simplHex
            minLz = lz
    return minNc, minNc_r, minNt, minNt_r, minLz, minLz_r

def calcComplexity(hexRule):
    ruleset = parseHexRule(hexRule)
    simplifyRuleset(ruleset)
    nColors = max(face['color'] for rule in ruleset for face in rule)
    #nRules = len(ruleset)
    return nColors #*nRules

def countCubeTypes(hexRule):
    return len(simplifyRuleset(parseHexRule(hexRule)))

def getNColors(ruleset):
    colorset = set([abs(face['color']) for rule in ruleset for face in rule])
    if 0 in colorset:
        return len(colorset) - 1
    else:
        return len(colorset)


def simplifyHexRule(hexRule):
    return ruleToHex(simplifyRuleset(parseHexRule(hexRule)))


def calculateSearchSpaceSize(
        nRules, nColors,
        nRotations=4,  # Each polycube face has one of 4 possible rotations
        nInteractionSites=6):  # Each polycube has 6 faces
    return pow(nRotations*(1 + 2*nColors), nInteractionSites*nRules)


# 0 sign
#/ 0 value 16
# 0 value 8
# 0 value 4

# 0 value 2
# 0 value 1
# 0 face orientation
# 0 face orientation

def ruleToHex(ruleset):
    hexRule = ''
    for rule in ruleset:
        for face in rule:
            sign = bin(face['color'] < 0)[2:]
            assert abs(face['color']) < 32, "Color value too large for hexadecimal rule"
            color = bin(abs(face['color']))[2:].zfill(5)
            orientation = bin(abs(face['orientation']))[2:].zfill(2)
            binStr = sign + color + orientation
            hexStr = hex(int(binStr, 2))[2:].zfill(2)
            hexRule += hexStr
    return hexRule



def simplifyRuleset(ruleset):
    colors = Counter([face['color'] for cube in ruleset for face in cube])
    newRuleset = []
    for iCube, cube in enumerate(ruleset):
        allZero = True
        for face in cube:
            if colors[face['color']*-1] == 0:
                # Remove patch if there is no matching color
                face['color'] = 0
            if face['color'] == 0:
                # Reset orientation if there is no patch color
                face['orientation'] = 0
            else:
                allZero = False
        if not allZero or iCube==0:
            newRuleset.append(cube)
    colorset = [x for x in {
            abs(face['color']) for cube in newRuleset for face in cube
    }.difference({0})]
    for cube in newRuleset:
        for face in cube:
            c = face['color']
            if c != 0:
                face['color'] = colorset.index(abs(c)) + 1
                if c < 0:
                    face['color'] *= -1
    return newRuleset

def toUrl(hexRule):
    return 'https://akodiat.github.io/polycubes?hexRule=' + hexRule

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

# From Chico adapted for Python 3.X
# Code previously from Ben Frot
# Originally from XXX paper

def KC_LZ(string):
    n=len(string)
    s = '0'+string
    c=1
    l=1
    i=0
    k=1
    k_max=1
    stop=0

    while stop==0:
        if s[i+k] != s[l+k]:
            if k>k_max:
                k_max=k

            i=i+1

            if i==l:
                c=c+1
                l=l+k_max

                if l+1>n:
                    stop=1

                else:
                    i=0
                    k=1
                    k_max=1
            else:
                k=1

        else:
            k=k+1

            if l+k>n:
                c=c+1
                stop=1

    # a la Lempel and Ziv (IEEE trans inf theory it-22, 75 (1976),
    # h(n)=c(n)/b(n) where c(n) is the kolmogorov complexity
    # and h(n) is a normalised measure of complexity.
    complexity=c;

    #b=n*1.0/np.log2(n)
    #complexity=c/b;

    return complexity


def calc_KC(s):
    L = len(s)
    if s == '0'*L or s == '1'*L:
        return np.log2(L)
    else:
        return np.log2(L)*(KC_LZ(s)+KC_LZ(s[::-1]))/2.0

def lzFromHexRule(hexRule):
    return calc_KC(bin(int(hexRule, 16))[2:])
