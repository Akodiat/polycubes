from collections import Counter
import os
import pickle

def loadPhenos(path="../cpp/out/3d/phenos"):
    phenos = []
    for root, dirs, files in os.walk(path):
        for file in files:
            phenos.extend(pickle.load(open(os.path.join(root, file), "rb")))
    return phenos

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
    return 'https://akodiat.github.io/polycubes?hexRule=' + alt.datum.rule

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
