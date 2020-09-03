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
def calcGenotypeRobustness(hexRule, maxColor=31, maxCubes=5, dim=3, radius=1):
    mutations = {hexRule}
    for _ in range(radius):
        mutations.update({y for x in (enumerateMutations(r, maxColor, maxCubes, dim) for r in mutations) for y in x})
    nEqual = sum(polycubes.checkEquality(hexRule, mutant) for mutant in mutations)
    return nEqual / len(mutations)

def calcPhenotypeRobustness(path='../cpp/out/3d', maxColor=31, maxCubes=5, dim=3, samplesPerPheno=20):
    phenos = utils.loadPhenos(os.path.join(path,'phenos'))
    total = sum(p['count'] for p in phenos)
    print("Loaded {} phenotypes".format(total))
    robustnesses = []
    random.shuffle(phenos)
    for i, p in enumerate(phenos):
        r = dict(p)
        sample = random.sample(p['genotypes'], min(samplesPerPheno, p['count']))
        robustnessVals = [calcGenotypeRobustness(
            hexRule, maxColor, maxCubes, dim
        ) for hexRule in sample]
        r['robustness'] = np.mean(robustnessVals)
        r['robustnessVar'] = np.var(robustnessVals)
        r['robustnessVals'] = robustnessVals
        robustnesses.append(r)
        print("Progress: {:n}% ({} of {})".format(
            100*i/total, i, total),
            end="\r", flush=True
        )
        if i % 100 == 0 and i>0:
            pickle.dump(robustnesses, open(os.path.join(path, 'robustness.p'), 'wb'))
    return robustnesses


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--path", help='Path to directory containing phenotype directory')
    parser.add_argument("--maxColor", default=31)
    parser.add_argument("--maxCubes", default=5)
    parser.add_argument("--dim", default=3, help='Number of dimensions (1,2 or 3)')
    parser.add_argument("--samples", default=20, help='Max number of samples per phenotype')
    args = parser.parse_args()
    if args.path:
        data = calcPhenotypeRobustness(args.path, int(args.maxColor), int(args.maxCubes), int(args.dim), int(args.samples))
        pickle.dump(data, open(os.path.join(args.path, 'robustness.p'), 'wb'))

calcPhenotypeRobustness('/home/joakim/repo/polycubes/cpp/out', 31, 5, 3, 10)