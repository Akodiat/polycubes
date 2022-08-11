from collections import Counter
import numpy as np
from scipy.spatial.transform import Rotation as R
import json
import numpy as np

## Utility functions

def parseDecRule(decRule):
    rule = []
    for s in decRule.split('_'):
        faces = []
        for face in s.split('|'):
            if face != '':
                color, orientation = [int(v) for v in face.split(':')]
            else:
                color = 0
                orientation = 0
            faces.append({
                'color': color,
                'orientation': orientation
            })
        rule.append(faces)
    return rule

def ruleToDec(ruleset):
    return '_'.join(
        '|'.join(
            "{}:{}".format(
                f['color'], f['orientation']
            ) for f in s
        ) for s in ruleset
    )

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

def translateToPolyominoNotation(ruleset):
    faceOrder = [1,3,0,2]
    cubes = []
    for cube in ruleset:
        faces = []
        for i in faceOrder:
            face = cube[i]
            color = 2*abs(face['color'])
            if face['color'] < 0:
                color -= 1
            faces.append(str(color))
        cubes.append(" ".join(faces))
    return " | ".join(cubes)

def patchRotToVec(i, rot):
    """ Get vector indicating patch rotation, given rotation state and face index

    Args:
        i (int): Index of patch [0...5]
        rot (int): Rotation state [0,1,2,3] = North , East, South, West

    Returns:
        vector: Patch rotation vector
    """
    v = getFaceRotations()[i]
    axis = getRuleOrder()[i]
    angle = rot * np.pi/2
    r = R.from_rotvec(angle * axis)
    return r.apply(v).round()

def getRuleOrder(nDim=3):
    """
    if nDim == 2:
        return [
            np.array([0, -1]), np.array([1, 0]),
            np.array([0, 1]), np.array([-1, 0])
        ]
    """
    return [
        np.array([-1, 0, 0]), np.array([1, 0, 0]),
        np.array([0, -1, 0]), np.array([0, 1, 0]),
        np.array([0, 0, -1]), np.array([0, 0, 1])
    ]

def getFaceRotations():
    return [
        np.array([0, -1, 0]), np.array([0, 1, 0]),
        np.array([0, 0, -1]), np.array([0, 0, 1]),
        np.array([-1, 0, 0]), np.array([1, 0, 0])
    ]


def getFlatFaceRot():
    return [1,1,2,0,0,0]


def rotAroundAxis(patchPos, axis, angle):
    r = R.from_rotvec(angle * axis)
    return r.apply(patchPos).round()


def getIndexOf(elem, array):
    for i, e in enumerate(array):
        if (e == elem).all():
            return i
    return -1


def getSignedAngle(v1, v2, axis):
    s = np.cross(v1, v2)
    c = v1.dot(v2)
    a = np.arctan2(np.linalg.norm(s), c)
    if not np.array_equal(s, axis):
        a *= -1
    return a


def coordsFromFile(path):
    with open(path) as f:
        return [[int(c) for c in line.strip('()\n').split(',')] for line in f]

def patchVecToRot(i, v):
    """ Get rotation state, given face index and patch rotation vector

    Args:
        i (int): Index of patch [0...5]
        v (vector): Patch rotation vector

    Returns:
        int: Rotation state [0,1,2,3] = North , East, South, West
    """
    angle = getSignedAngle(
        getFaceRotations()[i],
        v,
        getRuleOrder()[i]
    )
    return int((angle * (2/np.pi)+4) % 4)

def enumerateRotations():
    return {
        0: {0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5},
        1: {0: 0, 1: 1, 2: 3, 3: 2, 4: 5, 5: 4},
        2: {0: 0, 1: 1, 2: 4, 3: 5, 4: 3, 5: 2},
        3: {0: 0, 1: 1, 2: 5, 3: 4, 4: 2, 5: 3},
        4: {0: 1, 1: 0, 2: 2, 3: 3, 4: 5, 5: 4},
        5: {0: 1, 1: 0, 2: 3, 3: 2, 4: 4, 5: 5},
        6: {0: 1, 1: 0, 2: 4, 3: 5, 4: 2, 5: 3},
        7: {0: 1, 1: 0, 2: 5, 3: 4, 4: 3, 5: 2},
        8: {0: 2, 1: 3, 2: 0, 3: 1, 4: 5, 5: 4},
        9: {0: 2, 1: 3, 2: 1, 3: 0, 4: 4, 5: 5},
        10: {0: 2, 1: 3, 2: 4, 3: 5, 4: 0, 5: 1},
        11: {0: 2, 1: 3, 2: 5, 3: 4, 4: 1, 5: 0},
        12: {0: 3, 1: 2, 2: 0, 3: 1, 4: 4, 5: 5},
        13: {0: 3, 1: 2, 2: 1, 3: 0, 4: 5, 5: 4},
        14: {0: 3, 1: 2, 2: 4, 3: 5, 4: 1, 5: 0},
        15: {0: 3, 1: 2, 2: 5, 3: 4, 4: 0, 5: 1},
        16: {0: 4, 1: 5, 2: 0, 3: 1, 4: 2, 5: 3},
        17: {0: 4, 1: 5, 2: 1, 3: 0, 4: 3, 5: 2},
        18: {0: 4, 1: 5, 2: 2, 3: 3, 4: 1, 5: 0},
        19: {0: 4, 1: 5, 2: 3, 3: 2, 4: 0, 5: 1},
        20: {0: 5, 1: 4, 2: 0, 3: 1, 4: 3, 5: 2},
        21: {0: 5, 1: 4, 2: 1, 3: 0, 4: 2, 5: 3},
        22: {0: 5, 1: 4, 2: 2, 3: 3, 4: 0, 5: 1},
        23: {0: 5, 1: 4, 2: 3, 3: 2, 4: 1, 5: 0}
    }


def topFromFile(path, nDim=3):
    neigbourDirs = getRuleOrder(nDim)

    coords = [np.array(i) for i in coordsFromFile(path)]
    top = []
    empty = []
    donePairs = []  # Keep track so that only one bond per pair is saved

    # For each position
    for i, current in enumerate(coords):
        # Enumerate von Neumann neighborhood
        for dPi, dP in enumerate(neigbourDirs):
            neigbourPos = current + dP
            found = False
            # Check if current neighbor is among the positions
            for j, other in enumerate(coords):
                if (neigbourPos == other).all():
                    if not (j, i) in donePairs:
                        top.append((
                                i, dPi,
                                j, dPi + (1 if dPi % 2 == 0 else -1)))
                        donePairs.append((i, j))
                    found = True
            # If the current neigbour is empty, save
            if not found:
                empty.append((i, dPi))
    return top, empty

def calcEmptyFromTop(top):
    ids = set(i for i,_,_,_ in top).union(set(j for _,_,j,_ in top))
    patches = set(((i,dPi) for i,dPi,_,_ in top)).union(((j,dPj) for _,_,j,dPj in top))

    empty = []
    for i in ids:
        for dPi in range(6):
            if not (i, dPi) in patches:
                empty.append((i,dPi))
    return empty

def merge(i, j, pmaps, dPi):
    others = [m for mi, m in enumerate(pmaps) if not mi in [i,j]]
    jMoved = {k: v+dPi for k,v in pmaps[j].items()}
    merged = {**jMoved, **pmaps[i]}
    return others + [merged]

def calcCoordmapFromTop(top, nDim=3):
    dirs = getRuleOrder(nDim)
    indices = set(v for i,_,j,__ in top for v in [i, j])
    pmaps = [{i: np.array([0, 0, 0])} for i in indices]

    for i, dPi, j, dPj in top:
        iIdx = [i in m.keys() for m in pmaps].index(True)
        jIdx = [j in m.keys() for m in pmaps].index(True)
        pmaps = merge(iIdx,jIdx, pmaps, pmaps[iIdx][i] + dirs[dPi] - pmaps[jIdx][j])

    return pmaps

def calcCoordsFromTop(top, nDim=3):
    pmaps = calcCoordmapFromTop(top, nDim=3)
    return [np.array([v for v in posmap.values()]).T for posmap in pmaps]

def countParticlesAndBindings(topology):
    pidsa = [x[0] for x in topology]
    pidsb = [x[2] for x in topology]
    particles = pidsa + pidsb
    return max(particles)+1, len(topology)


def vectorAbs(v):
    return np.array([abs(x) for x in v])
def posToString(pos):
    return ",".join(str(x) for x in pos)
def bindingStr(a, b):
    return "{} {}".format(*sorted([posToString(a), posToString(b)]))

def simplifyRule(rule):
    colors = Counter([face['color'] for species in rule for face in species])
    newRuleset = []
    for iCube, species in enumerate(rule):
        allZero = True
        for iFace, face in enumerate(species):
            if colors[face['color']*-1] == 0:
                # Remove patch if there is no matching color
                face['color'] = 0
            if face['color'] == 0:
                # Reset orientation if there is no patch color
                face['alignDir'] = getFaceRotations()[iFace]
            else:
                allZero = False
        if not allZero or iCube==0:
            newRuleset.append(species)
    colorset = [x for x in {
        abs(face['color']) for species in newRuleset for face in species
    }.difference({0})]
    for species in newRuleset:
        for face in species:
            c = face['color']
            if c != 0:
                face['color'] = colorset.index(abs(c)) + 1
                if c < 0:
                    face['color'] *= -1
    return newRuleset

def getFullyAdressableRule(topology):
    coordMaps = calcCoordmapFromTop(topology)
    assert len(coordMaps) == 1, "Found {} shapes".format(len(coordMaps))
    coordMap = coordMaps[0]
    coords = coordMap.values()

    connectors = list(bindingStr(coordMap[b[0]], coordMap[b[2]]) for b in topology)

    # Find out which dimension has the fewest connectors
    dimCount = [0,0,0]
    dims = [
        np.array([1,0,0]),
        np.array([0,1,0]),
        np.array([0,0,1])
    ]

    for p in coords:
        for d in getRuleOrder():
            neigbourPos = p+d
            if bindingStr(p, neigbourPos) in connectors:
                for i in range(3):
                    if np.array_equal(vectorAbs(d), dims[i]):
                        dimCount[i] += 1
                        break

    minDim = dims[dimCount.index(min(dimCount))]

    # Initialise empty species
    rule = []
    cubePosMap = {}
    for iCube, p in enumerate(coords):
        cubeType = []
        for i, d in enumerate(getFaceRotations()):
            alignDir = d
            if not np.array_equal(getRuleOrder()[i], minDim):
                alignDir = minDim
            cubeType.append({'color':0, 'alignDir': alignDir})
        rule.append(cubeType)
        cubePosMap[posToString(p)] = iCube

    # Set colors and alignment direcitons
    colorCounter = 1
    for iCube, p in enumerate(coords):
        found = False
        for iFace, d in enumerate(getRuleOrder()):
            neigbourPos = p+d
            if bindingStr(p, neigbourPos) in connectors:
                found = True
                invDir = -d
                iFaceNeigh = list(np.array_equal(invDir, v) for v in getRuleOrder()).index(True)
                iCubeNeigh = cubePosMap[posToString(neigbourPos)]

                rule[iCube][iFace]['color'] = colorCounter
                rule[iCubeNeigh][iFaceNeigh]['color'] = -colorCounter
                rule[iCubeNeigh][iFaceNeigh]['alignDir'] = rule[iCube][iFace]['alignDir']

                colorCounter += 1
        if not found:
            print("{} not found in connections".format(posToString(p)))

    rule = [[{
        'color': face['color'],
        'orientation': round(getSignedAngle(
            getFaceRotations()[i],
            face['alignDir'],
            getRuleOrder()[i]
        )*(2/np.pi)+4) % 4
    } for i, face in enumerate(s)] for s in rule]

    return rule
