import numpy as np
from scipy.spatial.transform import Rotation as R

## Utility functions
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

def countParticlesAndBindings(topology):
    pidsa = [x[0] for x in topology]
    pidsb = [x[2] for x in topology]
    particles = pidsa + pidsb
    return max(particles)+1, len(topology)