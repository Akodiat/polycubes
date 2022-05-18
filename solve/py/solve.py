#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Created on Tue Oct 29 11:16:24 2019

@author: joakim
"""

import re
import libpolycubes
import utils
from polycubeSolver import polysat
import sys
import multiprocessing
import json
import traceback
import os

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
    #os.remove(path)
    return readSolution(sol)

def find_solution(top, nCubeTypes, nColors, nSolutions=1, nDim=3, torsionalPatches=True):
    """Find a polycube rule that assembles the given topology

    Args:
        topPath (string): Path to topology text file
        nCubeTypes (int): Number of different building block cubes (species)
        nColors (int): Number of colors (not counting negative)
        uniquePatches (bool, optional): Set to true if you want to ensure determinism, but also limit modularity. Defaults to False.

    Returns:
        [dict]: Returns a polycube rule dict.
    """

    mysat = polysat(top, nCubeTypes, nColors, nDim, torsionalPatches)

    if nSolutions == 1: # Use minisat for single solutions
        result, solution = mysat.solve()
        if result == 'TIMEOUT':
            return result
        elif result:
            return [readSolution(solution)]
        else:
            return []
    else:
        timeout = 86400 # 24h in seconds
        result = mysat.run_relsat(nSolutions=nSolutions, timeout=timeout)
        if result == "TIMEOUT":
            return result
        nResults, results = result
        if nResults > 0:
            #print("{} solutions found".format(nResults))
            return [readSolution("/n".join(sol)) for sol in results]
        else:
            return []

def smartEnumerate(xMax, yMax):
    return sorted(
        ((x,y) for x in range(1, xMax+1) for y in range(1, yMax+1)),
        key=lambda i: sum(i)
    )

def patchCount(cube):
    return len([face for face in cube if face['color'] != 0])

def findRuleFor(top, nCubeTypes, nColors, nSolutions, nDim=3, torsionalPatches=True):
    i = "{},{}".format(nCubeTypes,nColors)
    log = '\n{} colors and {} cube types: '.format(nColors, nCubeTypes)
    try:
        rules = find_solution(top, nCubeTypes, nColors, nDim=nDim, torsionalPatches=torsionalPatches)
    except Exception as error:
        log +="Error in find_solution: {}\n\t{}".format(error, traceback.format_exc())
        return (i, 'ERROR', log)

    if rules == 'TIMEOUT':
        log += "Timed out!"
        return (i, rules, log)
    if len(rules) > 0:
        rule = sorted(rules[0], key=patchCount, reverse=True)
        decRule = utils.ruleToDec(rule)
        if libpolycubes.isBoundedAndDeterministic(decRule, isHexString=False):
            return (i, decRule, log)
        else:
            log += '{} is UND\n'.format(decRule)
            try:
                sols = find_solution(
                    top, nCubeTypes, nColors, nSolutions=nSolutions, nDim=nDim,
                    torsionalPatches=torsionalPatches
                )
            except Exception as error:
                log +="Error in find_solution: {}\n\t{}".format(error, traceback.format_exc())
                return (i, 'ERROR', log)

            if sols == 'TIMEOUT':
                return (i, sols, log)
            altrules = set(utils.ruleToDec(sorted(r, key=patchCount)) for r in sols)
            log += '  Trying {} alternative solutions\n'.format(len(altrules))
            for altrule in altrules:
                if libpolycubes.isBoundedAndDeterministic(altrule, isHexString=False):
                    log += '  {} is a valid solution\n'.format(altrule)
                    return (i, altrule, log)
                else:
                    log += '  {} is UND\n'.format(altrule)
            log += '  All UND'
            return (i, 'UND', log)
    else:
        log += 'Sorry, no solution'
    return (i, None, log)

results = {}
finalResult = None
ongoing = 0
def log_result(result):
    global ongoing
    ongoing -= 1
    i, rule, log = result
    global results
    global finalResult
    results[i] = rule
    if rule and rule != 'UND' and rule != 'TIMEOUT' and rule != 'ERROR':
        polyurl = "https://akodiat.github.io/polycubes?decRule={}"
        log += 'Found solution: '+polyurl.format(rule)
    print(log, flush=True)

    nCubeTypes, nColors = [int(e) for e in i.split(',')]
    # Check if all simpler solutions have been ruled out
    for inT, inC in smartEnumerate(nCubeTypes, nColors):
        key = "{},{}".format(inT,inC)
        if not key in results or finalResult:
            # Break if we either have no answer for this level
            # or we already have the solution there
            break
        r = results[key]
        if r and r != 'UND' and r != 'TIMEOUT' and r != 'ERROR':
            # Lower levels have been ruled out and
            # we have our final result
            print('Finished!', flush = True)
            finalResult = r
            break

    # Pretty print status
    OKBLUE = '\033[94m'
    OKGREEN = '\033[92m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    nTs = max(int(k.split(',')[0]) for k in results.keys())
    nCs = max(int(k.split(',')[1]) for k in results.keys())
    for nt in range(0,nTs+1):
        for nc in range(0,nCs+1):
            if nt==0 and nc!=0:
                print("nC={}".format(nc), end='\t', flush=True)
            elif nc==0 and nt!=0:
                print("nT={}".format(nt), end='\t', flush=True)
            elif nc>0 and nt>0:
                key = '{},{}'.format(nt,nc)
                r = results[key] if key in results else '...'
                line = str(r)
                if r == 'UND' or r == 'TIMEOUT' or r == 'ERROR':
                    line = OKBLUE+str(r)
                elif r is None :
                    line = FAIL+str(r)
                elif r != '...':
                    line = OKGREEN+str(r)
                if key == i:
                    line = BOLD+line
                print(line+ENDC, end='\t', flush=True)
            else:
                print(end='\t', flush=True)
        print(flush=True)
    #print([(results[i] if i in results else '') for i in range(max(results.keys())+1)])

def log_error(error):
    print('got error: {}'.format(error), flush=True)
    raise error

def parallelFindMinimalRule(top, maxCubeTypes='auto', maxColors='auto', nSolutions=100, nDim=3, torsionalPatches=True):
    # Never need to check for more than the topology can specify
    maxNT, maxNC = utils.countParticlesAndBindings(top)
    if maxCubeTypes == 'auto':
        maxCubeTypes = maxNT
    if maxColors == 'auto':
        maxColors = maxNC
    global ongoing
    asyncResults = []
    with multiprocessing.Pool(maxtasksperchild=1) as p:
        for nCubeTypes, nColors in smartEnumerate(maxCubeTypes, maxColors):
            r = p.apply_async(
                findRuleFor,
                args = (top, nCubeTypes, nColors, nSolutions, nDim, torsionalPatches),
                callback = log_result,
                error_callback = log_error
            )
            asyncResults.append(r)
        while not finalResult:
            pass
        return finalResult

def findRules(topPath, nCubeTypes='auto', nColors='auto', nSolutions='auto', nDim=3, torsionalPatches=True):
    polyurl = "https://akodiat.github.io/polycubes?rule={}"
    if nCubeTypes == 'auto' or nColors == 'auto':
        if nSolutions == 'auto':
            nSolutions = 100
        r = [parallelFindMinimalRule(topPath, nSolutions=nSolutions, nDim=nDim, torsionalPatches=torsionalPatches)]
    else:
        if nSolutions == 'auto':
            nSolutions = 1
        sols = find_solution(topPath, nCubeTypes, nColors, nSolutions, nDim, torsionalPatches)
        if sols == 'TIMEOUT':
            print('Timed out')
            return
        r = [utils.ruleToDec(rule) for rule in sols]
    if len(r) > 0:
        for rule in r:
            print(polyurl.format(rule), flush=True)
            if nDim == 2:
                print(utils.translateToPolyominoNotation(utils.parseDecRule(rule)))
        return r
    else:
        print('Sorry, no solution found', flush=True)
        return

def solve(solveSpecPath, nCubeTypes=None, nColors=None):
    with open(solveSpecPath, 'r') as f:
        data = f.read()
    solveSpec = json.loads(data)
 
    if (nCubeTypes != None and nColors != None):
        (i, rules, log) = findRuleFor(
            solveSpec['bindings'],
            nCubeTypes, nColors, nSolutions=1000,
            nDim=solveSpec['nDim'],
            torsionalPatches=solveSpec['torsion']
        )
        print(log)
        print(rules)
        return rules
    else:
        return parallelFindMinimalRule(
            solveSpec['bindings'],
            nDim=solveSpec['nDim'],
            torsionalPatches=solveSpec['torsion']
        )

def newSolve(solveSpecPath, nCubeTypes, nColors, ratioLimit=1.0, maxTries=1000):
    print("Solving {} for {}s {}c on pid={}".format(solveSpecPath, nCubeTypes, nColors, os.getpid()))
    with open(solveSpecPath, 'r') as f:
        data = f.read()
    solveSpec = json.loads(data)

    mysat = polysat(
        solveSpec['bindings'],
        nCubeTypes,
        nColors,
        solveSpec['nDim'],
        solveSpec['torsion']
    )

    nVars = max(mysat.variables.values())
    nClauses = len(mysat.basic_sat_clauses)
    print("Using {} variables and {} clauses".format(nVars, nClauses))

    shapes = utils.calcCoordsFromTop(solveSpec['bindings'])

    if len(shapes) > 1:
        print("Multifarious assembly")

    nTries = 0
    maxRatio = 0
    while nTries < maxTries:
        result, solution = mysat.solve(3600) # Timeout after one hour
        if result == 'TIMEOUT':
            print('Sorry, timed out')
        elif result:
            rule = sorted(readSolution(solution), key=patchCount, reverse=True)
            decRule = utils.ruleToDec(rule)
            ratiosum = 0
            for shape in shapes:
                ratio = libpolycubes.assembleRatio(shape, decRule, isHexString=False, assemblyMode='seeded', torsion=solveSpec['torsion'])
                if ratio == 0:
                    print("Shape {}never assembled".format((("{} ").format(shape) if len(shapes)>1 else '')))
                    ratiosum = 0
                    break
                else:
                    ratiosum += ratio
            if ratiosum >= ratioLimit:
                print("Found solution: https://akodiat.github.io/polycubes/?decRule={} at assembly ratio {}".format(utils.ruleToDec(rule), ratiosum))
                return utils.ruleToDec(rule)
            else:
                if ratiosum > 0:
                    print("Solution {} assembles, but only at assembly ratio {}. {} tries left".format(utils.ruleToDec(rule), ratiosum, maxTries-nTries))
                    maxRatio = max(maxRatio, ratiosum)
                mysat.forbidSolution(solution)
                nTries += 1
        else:
            print("No solution possible")
            return None
    print("No valid solution found after {} tries".format(maxTries))
    return maxRatio

if __name__ == '__main__':
    import time
    start = time.time()
    if len(sys.argv) > 3:
        print(newSolve(sys.argv[1], int(sys.argv[2]), int(sys.argv[3])))
    elif len(sys.argv) > 1:
        solve(sys.argv[1]);
    else:
        print("Need to provide path to a shape json file [shapePath, nCubeTypes, nColors]")
    end = time.time()
    print("Finished in {} seconds".format(end-start))
