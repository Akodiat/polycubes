import utils
import polycubes
import numpy as np
import pandas as pd
import os
import random
import pickle
from multiprocessing import Pool

# Enumerate all genotypes one point mutation away
def enumerateMutations(hexRule, maxColor=31, maxCubes=5, dim=3):
    emptyCube = "000000000000"
    orientations = range(4)
    colors = range(-maxColor, maxColor+1)
    # Pad with empty cubes
    while len(hexRule) < maxCubes * len(emptyCube):
        hexRule += emptyCube
        
    mutations = []
    rule = utils.parseHexRule(hexRule)
    for i, cube in enumerate(rule):
        for j, face in enumerate(cube):
            for color in colors:
                if color != face['color']:
                    newRule = utils.parseHexRule(hexRule)
                    newRule[i][j]['color'] = color
                    newHexRule = utils.ruleToHex(newRule)
                    assert(len(newHexRule) == maxCubes * len(emptyCube))
                    mutations.append(newHexRule)
            if dim == 3:
                for orientation in orientations:
                    if orientation != face['orientation']:
                        newRule = utils.parseHexRule(hexRule)
                        newRule[i][j]['orientation'] = orientation
                        mutations.append(utils.ruleToHex(newRule))
    return mutations

# Calculate the fraction of mutational neigbours that produce the same phenotype
def calcGenotypeRobustness(hexRule, maxColor=31, maxCubes=5, dim=3):
    mutations = enumerateMutations(hexRule, maxColor, maxCubes, dim)
    nEqual = sum(polycubes.checkEquality(hexRule, mutant) for mutant in mutations)
    return nEqual / len(mutations)

def calcPhenotypeRobustness(path='../cpp/out/3d', maxColor=31, maxCubes=5, dim=3):
    phenos = utils.loadPhenos(os.path.join(path,'phenos'))
    total = sum(p['count'] for p in phenos)
    print("Loaded {} phenotypes".format(total))
    robustnesses = []
    for i, p in enumerate(phenos):
        print("On phenotype with rule: {}".format(p['rule']))
        robustnesses.append({
            'rule': p['rule'],
            'robustness': sum(calcGenotypeRobustness(
                hexRule, maxColor, maxCubes, dim
                ) for hexRule in p['genotypes'])/p['count'],
            'freq': p['freq']
        })
        print("Progress: {:n}% ({} of {})".format(100*i/total, i, total), end="\r", flush=True)
        if i % 100 == 0 and i>0:
            pickle.dump(pd.DataFrame(data=robustnesses), open(os.path.join(path, 'robustness.p'), 'wb'))
    data = pd.DataFrame(data=robustnesses)
    return data


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--path")
    parser.add_argument("--maxColor", default=31)
    parser.add_argument("--maxCubes", default=5)
    parser.add_argument("--dim", default=3)
    args = parser.parse_args()
    if args.path:
        data = calcPhenotypeRobustness(args.path, int(args.maxColor), int(args.maxCubes), int(args.dim))
        pickle.dump(data, open(os.path.join(args.path, 'robustness.p'), 'wb'))

