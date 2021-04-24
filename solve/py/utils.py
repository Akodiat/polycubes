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


def newIdxAfterAxisRot(patchPos):
    # Find the new index that each face has rotated too, by comparing
    # original vectors to the rotated ones in patchPos
    return {i:getIndexOf(e, getRuleOrder()) for i, e in enumerate(patchPos)}


def newOriAfterAxisRot(patchRot):
    return {i:patchVecToRot(i, e) for i, e in enumerate(patchRot)}


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

def enumerateRotations(dim=3):
    """
    if dim==2:
        return {
            0: {0:0, 1:1, 2:2, 3:3},
            1: {0:1, 1:2, 2:3, 3:0},
            2: {0:2, 1:3, 2:0, 3:1},
            3: {0:3, 1:0, 2:1, 3:2}
        }
    """
    initPatchPos = getRuleOrder()

    # X, Y, Z
    axes = [
        np.array([1, 0, 0]),
        np.array([0, 1, 0]),
        np.array([0, 0, 1])
    ]

    # Rotate only around z-axis in 2D
    if dim==2:
        axes = [np.array([0, 0, 1])]

    # Get initial rotation
    r = newIdxAfterAxisRot(initPatchPos)
    
    # Save rotations in a set to avoid duplicates
    # Need to make strings of everything since the set needs
    # something hashable...
    rotations = set([str(r)])

    # Rotate around each axis in 90 deg increments, up to a whole turn
    # to make sure we enumerate every possible rotation
    for nTurns in range(4):
        # Set angle to turn
        v = nTurns*np.pi/2
        for a1 in axes:
            # Rotate patch position and orientation vectors
            patchPos1 = rotAroundAxis(initPatchPos, a1, v)
            # Convert to patch id:s
            r1 = newIdxAfterAxisRot(patchPos1)
            # Save result to set and map
            rotations.add(str(r1))
            # Run again for another (or the same) axis
            for a2 in axes:
                patchPos2 = rotAroundAxis(patchPos1, a2, v)
                r2 = newIdxAfterAxisRot(patchPos2)
                rotations.add(str(r2))
                # Run again for yet another (or the same) axis
                for a3 in axes:
                    patchPos3 = rotAroundAxis(patchPos2, a3, v)
                    r3 = newIdxAfterAxisRot(patchPos3)
                    rotations.add(str(r3))
    return {i: eval(e) for i, e in enumerate(sorted(rotations))}


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

def countParticlesAndBindings(topology):
    pidsa = [x[0] for x in topology]
    pidsb = [x[2] for x in topology]
    particles = pidsa + pidsb
    return max(particles)+1, len(topology)