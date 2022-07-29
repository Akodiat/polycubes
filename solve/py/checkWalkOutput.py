
import sys
import re
import libpolycubes
from polycubeSolver import polysat
import json
import utils
import pickle

def readSolution(sol):
    colorCounter = 1
    colorMap = {}
    ruleMap = {}
    bMatches = re.findall(r'B\((\d+),(\d+)\)', sol)
    for c1, c2 in bMatches:  # color c1 binds with c2
        # print("Color {} binds with {}".format(c1, c2))
        assert(c1 not in colorMap or c2 not in colorMap)
        if int(c1) < 2 or int(c2) < 2:
            colorMap[c1] = 0
            colorMap[c2] = 0
        else:
            colorMap[c1] = colorCounter
            colorMap[c2] = -colorCounter
            colorCounter += 1
    cMatches = re.findall(r'C\((\d+),(\d+),(\d+)\)', sol)
    for s, p, c in cMatches:  # Patch p on species s has color c
        #print("Patch {} on species {} has color {}".format(p, s, c))
        if s not in ruleMap:
            ruleMap[s] = {}
        if p not in ruleMap[s]:
            ruleMap[s][p] = {}
        ruleMap[s][p]['color'] = colorMap[c]
    oMatches = re.findall(r'O\((\d+),(\d+),(\d+)\)', sol)
    if len(oMatches) == 0:
        print("Found no orientation values")
        for patches in ruleMap.values():
            for i, p in patches.items():
                p['orientation'] = utils.getFlatFaceRot()[int(i)]
    else:
        for s, p, o in oMatches:  # Patch on species l has orientation o
            #print("Patch {} on species {} has orientation {}".format(p, s, o))
            ruleMap[s][p]['orientation'] = int(o)
    return [rule.values() for rule in ruleMap.values()]

def readSolutionFromPath(path):
    with open(path) as f:
        sol = f.read()
    return readSolution(sol)

def ruleToDec(ruleset):
    return '_'.join(
        '|'.join(
            "{}:{}".format(
                f['color'], f['orientation']
            ) for f in s
        ) for s in ruleset
    )

def patchCount(cube):
    return len([face for face in cube if face['color'] != 0])

def handleSol(solution, shape):
    rule = sorted(readSolution(solution), key=patchCount, reverse=True)
    decRule = ruleToDec(rule)
    print("Solution: https://akodiat.github.io/polycubes?decRule={}".format(decRule), flush=True)
    colors = set()
    for s in rule:
        for f in s:
            colors.add(abs(f['color']))
    print("  Using {} species and {} colors".format(len(rule), len(colors)), flush=True)
    ratio = libpolycubes.assembleRatio(shape, decRule, isHexString=False, assemblyMode='seeded', torsion=solveSpec['torsion'])
    print("  Assemble ratio {}".format(ratio), flush=True)

def convertSol(variables, sols):
    assert len(sols) <= len(variables), "Solution has more variables ({}) than expected ({})".format(len(sols), len(variables))
    out = ""

    for vname, vnum in sorted(variables.items()):
        if vnum > len(sols):
            break
        if sols[vnum-1] > 0:
            out += vname+'\n'
    return out

if __name__ == '__main__':
    path = sys.argv[1]
    variablesPicklePath = sys.argv[2]
    solveSpecPath = sys.argv[3]

    with open(variablesPicklePath, 'rb') as f:
        variables = pickle.load(f)

    with open(solveSpecPath, 'r') as f:
        data = f.read()
    solveSpec = json.loads(data)
    shapes = utils.calcCoordsFromTop(solveSpec['bindings'])

    with open(path) as f:
        sol = []
        reading = False
        for line in f:
            if "Begin assign" in line:
                sol = []
                reading = True
            elif "End assign" in line:
                solution = convertSol(variables, sol)
                handleSol(solution, shapes[0])
                reading = False
            elif reading:
                for v in line.split():
                    sol.append(int(v))

    print("Done reading file "+path, flush=True)

